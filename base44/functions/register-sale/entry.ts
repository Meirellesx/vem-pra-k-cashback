import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import {
  getConnection, getProjectRef, getServiceRoleKey, pgList, pgInsert, pgUpdate, pgRpc,
  insertCashbackNotification,
} from '../../shared/supabase.ts';
import { mirrorRow, mirrorCustomerFromSupabase } from '../../shared/nativeMirror.ts';
import { insertWhatsappOnCashbackGenerated } from '../../shared/cashbackWhatsapp.ts';

// Registra uma venda + geração de cashback + atualização de saldo + auditoria
// em uma ÚNICA invocação, resolvendo a conexão Supabase uma vez e reutilizando a
// service_role key para todas as operações. Evita o rate-limit (HTTP 500) que
// ocorria quando o frontend fazia 5 chamadas rápidas sequenciais ao supabase-data.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const num = (v) => (typeof v === 'number' && isFinite(v) ? v : 0);

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const {
      sale_number, customer_id, customer_name, total_amount, eligible_amount,
      cashback_amount, payment_method, sale_date, category_id, operator_id,
      notes, is_demo, generate_cashback, cashback_status, available_date,
      expiry_date, operator_name, operator_role,
    } = body;

    if (!sale_number || !total_amount || !payment_method || !sale_date) {
      return Response.json({ error: 'Campos obrigatórios ausentes.' }, { status: 400 });
    }
    // Validação defensiva para o SQL de incremento de saldo.
    if (customer_id && !UUID_RE.test(String(customer_id))) {
      return Response.json({ error: 'customer_id inválido.' }, { status: 400 });
    }
    const cbAmount = num(cashback_amount);

    const conn = await getConnection(base44);
    const ref = await getProjectRef(conn.accessToken);
    const key = await getServiceRoleKey(conn.accessToken, ref);

    // 1. Verifica duplicidade do número da venda.
    const existing = await pgList(key, ref, 'sales', { filters: { sale_number }, limit: 1 });
    if (existing && existing.length > 0) {
      return Response.json({ error: `Venda #${sale_number} já foi registrada! Verifique o número.` }, { status: 409 });
    }

    // 2. Cria a venda (fonte da verdade).
    const sale = await pgInsert(key, ref, 'sales', {
      sale_number,
      customer_id: customer_id || null,
      customer_name: customer_name || null,
      total_amount: num(total_amount),
      eligible_amount: num(eligible_amount || total_amount),
      cashback_amount: cbAmount,
      cashback_used: 0,
      payment_method,
      sale_date,
      category_id: category_id || null,
      status: 'concluida',
      cashback_generated: !!generate_cashback,
      operator_id: operator_id || null,
      notes: notes || null,
      is_demo: !!is_demo,
      created_by_id: user.id,
    });

    const cbStatus = cashback_status || 'disponivel';
    let txId = null;
    let tx = null;

    if (generate_cashback && cbAmount > 0 && customer_id) {
      // 3. Cria a transação de cashback e vincula à venda.
      tx = await pgInsert(key, ref, 'cashback_transactions', {
        customer_id,
        customer_name: customer_name || null,
        sale_id: sale.id,
        sale_number,
        amount: cbAmount,
        type: 'gerado',
        status: cbStatus,
        used_amount: 0,
        transaction_date: sale_date,
        available_date: available_date || null,
        expiry_date: expiry_date || null,
        operator_id: operator_id || null,
        is_demo: !!is_demo,
        created_by_id: user.id,
      });
      txId = tx.id;
      await pgUpdate(key, ref, 'sales', sale.id, { cashback_transaction_id: txId });
    }

    // 4. Cliente: saldo + last_purchase_at numa única RPC rápida (PostgREST).
    //    Cobre venda sem cashback (p_cashback = 0 → só atualiza last_purchase_at).
    if (customer_id) {
      await pgRpc(key, ref, 'apply_sale_to_customer', {
        p_customer_id: customer_id,
        p_cashback: txId ? cbAmount : 0,
        p_status: cbStatus,
        p_sale_date: /^\d{4}-\d{2}-\d{2}$/.test(String(sale_date)) ? sale_date : null,
      }).catch((e) => { console.error('apply_sale_to_customer error:', e.message); });
    }

    // 5. Efeitos colaterais independentes, em paralelo.
    let notif = null;
    if (txId) {
      const [, notifRes] = await Promise.all([
        insertWhatsappOnCashbackGenerated(conn.accessToken, key, ref, {
          customer_id,
          customer_name: customer_name || '',
          sale_id: sale.id,
          cashback_id_origem: txId,
          valor_compra: num(total_amount),
          valor_cashback_gerado: cbAmount,
          expiry_date: expiry_date || null,
          is_demo: !!is_demo,
        }).catch((e) => { console.error('cashback_whatsapp insert error:', e.message); return null; }),
        insertCashbackNotification(key, ref, {
          customer_id,
          customer_name: customer_name || '',
          event: 'gerado',
          amount: cbAmount,
          available_date: available_date || null,
          is_demo: !!is_demo,
        }).catch(() => null),
      ]);
      notif = notifRes;
    }

    // 6. Auditoria.
    const audit = await pgInsert(key, ref, 'audit_logs', {
      user_id: operator_id || user.id,
      user_name: operator_name || user.full_name || 'Sistema',
      user_role: operator_role || user.role || 'sistema',
      action: 'register_sale',
      entity_type: 'Sale',
      entity_id: sale.id,
      description: `Venda #${sale_number} registrada para ${customer_name || 'cliente'} — R$ ${num(total_amount).toFixed(2).replace('.', ',')}`,
      justification: '',
      before_data: '',
      after_data: JSON.stringify(sale),
      ip_address: '',
      is_demo: !!is_demo,
      created_by_id: user.id,
    } as any);

    // 7. Espelho para o Base44 nativo — BACKUP best-effort, fora do caminho
    //    crítico: todos em paralelo (antes eram ~12 chamadas em fila).
    const saleForMirror = txId
      ? { ...sale, cashback_transaction_id: txId, cashback_generated: true }
      : sale;
    const mirrors = [
      mirrorRow(base44, 'sales', saleForMirror),
      mirrorRow(base44, 'audit_logs', audit),
    ];
    if (txId) {
      mirrors.push(
        mirrorRow(base44, 'cashback_transactions', tx),
        mirrorCustomerFromSupabase(base44, key, ref, customer_id),
      );
      if (notif) mirrors.push(mirrorRow(base44, 'notifications', notif));
    }
    await Promise.allSettled(mirrors);

    return Response.json({ sale, cashback_transaction_id: txId, cashback_amount: cbAmount });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}