import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import {
  getConnection, getProjectRef, getServiceRoleKey, pgList, pgInsert, pgUpdate, runSql,
  insertCashbackNotification,
} from '../../shared/supabase.ts';
import { mirrorRow, patchNativeByLegacyId, mirrorCustomerFromSupabase } from '../../shared/nativeMirror.ts';
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

    // 2. Cria a venda.
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
    await mirrorRow(base44, 'sales', sale);

    // 2.5. Denormaliza a data da última compra do cliente (fluxo de inatividade do
    //      n8n lê só customers). GREATEST evita retroceder se registrarem venda antiga.
    if (customer_id) {
      const saleDateExpr = /^\d{4}-\d{2}-\d{2}$/.test(String(sale_date))
        ? `'${sale_date}'::timestamptz`
        : "(timezone('UTC', now() AT TIME ZONE 'America/Sao_Paulo'))";
      await runSql(conn.accessToken, ref,
        `UPDATE customers SET last_purchase_at = GREATEST(COALESCE(last_purchase_at, '1970-01-01'::timestamptz), ${saleDateExpr}) WHERE id = '${customer_id}';`
      ).catch((e) => { console.error('last_purchase_at update error:', e.message); });
    }

    let txId = null;
    if (generate_cashback && cbAmount > 0 && customer_id) {
      // 3. Cria a transação de cashback.
      const tx = await pgInsert(key, ref, 'cashback_transactions', {
        customer_id,
        customer_name: customer_name || null,
        sale_id: sale.id,
        sale_number,
        amount: cbAmount,
        type: 'gerado',
        status: cashback_status || 'disponivel',
        used_amount: 0,
        transaction_date: sale_date,
        available_date: available_date || null,
        expiry_date: expiry_date || null,
        operator_id: operator_id || null,
        is_demo: !!is_demo,
        created_by_id: user.id,
      });
      txId = tx.id;

      await mirrorRow(base44, 'cashback_transactions', tx);

      // 4. Atualiza o saldo do cliente (incremento atômico via SQL).
      const col = cashback_status === 'disponivel' ? 'available_balance' : 'pending_balance';
      await runSql(conn.accessToken, ref,
        `UPDATE customers SET ${col} = ${col} + ${cbAmount}, total_cashback_earned = total_cashback_earned + ${cbAmount} WHERE id = '${customer_id}';`);
      await mirrorCustomerFromSupabase(base44, key, ref, customer_id);

      // 5. Vincula a transação à venda.
      await pgUpdate(key, ref, 'sales', sale.id, { cashback_transaction_id: txId });
      await patchNativeByLegacyId(base44, 'sales', sale.id, { cashback_transaction_id: txId, cashback_generated: true });

      // 5.5. Alimenta a tabela operacional cashback_whatsapp (futura integração
      //      n8n/Avisa). Nenhum envio de mensagem nesta etapa.
      await insertWhatsappOnCashbackGenerated(conn.accessToken, key, ref, {
        customer_id,
        customer_name: customer_name || '',
        sale_id: sale.id,
        cashback_id_origem: txId,
        valor_compra: num(total_amount),
        valor_cashback_gerado: cbAmount,
        expiry_date: expiry_date || null,
        is_demo: !!is_demo,
      }).catch((e) => { console.error('cashback_whatsapp insert error:', e.message); });

      // 6. Cria a notificação in-app de cashback gerado (o bot apresenta ao cliente).
      const notif = await insertCashbackNotification(key, ref, {
        customer_id,
        customer_name: customer_name || '',
        event: 'gerado',
        amount: cbAmount,
        available_date: available_date || null,
        is_demo: !!is_demo,
      }).catch(() => null);
      if (notif) await mirrorRow(base44, 'notifications', notif);
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
    await mirrorRow(base44, 'audit_logs', audit);

    return Response.json({ sale, cashback_transaction_id: txId, cashback_amount: cbAmount });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}