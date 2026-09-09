// Adaptador CRUD genérico para as tabelas do projeto "Cashback" no Supabase.
// Usa o módulo compartilhado supabase.ts (project ref hardcoded + retry na service key).
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import {
  getConnection, getProjectRef, ensureTables, listTables, authMe,
  getServiceRoleKey, pgList, pgGet, pgInsert, pgUpdate, pgDelete, runSql, nowBrasilia, pgSearch, pgCount, pgRpc,
} from '../../shared/supabase.ts';
import { mirrorRow, mirrorDelete } from '../../shared/nativeMirror.ts';
import { syncConsentsToWhatsapp, cancelWhatsappBySale, recomputePilotStatus } from '../../shared/cashbackWhatsapp.ts';

// Tabelas permitidas para CRUD genérico via esta função.
// Todas as entidades do app agora vivem no Supabase; o Base44 funciona apenas como backup.
const CRUD_TABLES = new Set([
  'customers', 'sales', 'cashback_transactions', 'cashback_redemptions',
  'internal_accounts', 'cashback_settings', 'product_categories',
  'audit_logs', 'staff_invitations', 'notifications', 'consent_records',
]);

// Registra em consent_records a alteração de um consentimento (origem: painel).
async function recordConsent(key, ref, customerId, customerName, consentType, accepted) {
  const row = await pgInsert(key, ref, 'consent_records', {
    customer_id: customerId,
    customer_name: customerName || '',
    consent_type: consentType,
    accepted: !!accepted,
    consent_date: nowBrasilia(),
    ip_address: '',
    version: 'painel',
  }).catch(() => null);
  return row;
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);

    const body = await req.json().catch(() => ({}));
    const { op, table } = body;

    // Keep-warm: aquece o isolate + o cache de conexão. Não exige usuário.
    if (op === 'ping') {
      try {
        const c = await getConnection(base44);
        const r = await getProjectRef(c.accessToken);
        await getServiceRoleKey(c.accessToken, r);
      } catch (_) { /* ignora */ }
      return Response.json({ ok: true, warm: true });
    }

    const user = await authMe(base44, req);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const conn = await getConnection(base44);
    const ref = await getProjectRef(conn.accessToken);

    // ===== Agregações server-side (RPC PostgREST, allowlist) =====
    if (op === 'rpc') {
      const RPC_ALLOW = new Set(['dashboard_stats', 'report_stats']);
      if (!RPC_ALLOW.has(body.fn)) {
        return Response.json({ error: 'RPC não permitida.' }, { status: 400 });
      }
      const rpcKey = await getServiceRoleKey(conn.accessToken, ref);
      const data = await pgRpc(rpcKey, ref, body.fn, body.args || {});
      return Response.json({ data });
    }

    // ===== Operações administrativas (setup / saúde / migração) =====
    if (op === 'setup' || op === 'health' || op === 'listTables' || op === 'migrateAll' || op === 'migrateCustomers' || op === 'migrateInternalAccounts' || op === 'migrateSettings' || op === 'migrateCategories' || op === 'migrateAuditLogs' || op === 'migrateStaffInvitations' || op === 'resetCustomerBalances' || op === 'cleanupTestWhatsapp' || op === 'migrateTimezoneBrasilia') {
      if (user.role !== 'admin') {
        return Response.json({ error: 'Forbidden — apenas administradores.' }, { status: 403 });
      }
      if (op === 'setup') {
        const tables = await ensureTables(conn.accessToken, ref);
        return Response.json({ success: true, project_ref: ref, tables });
      }
      if (op === 'health' || op === 'listTables') {
        const tables = await listTables(conn.accessToken, ref);
        return Response.json({ success: true, project_ref: ref, tables });
      }
      if (op === 'resetCustomerBalances') {
        // Zera saldos/totalizadores de todos os clientes (dados de teste).
        await runSql(conn.accessToken, ref,
          'UPDATE customers SET available_balance = 0, pending_balance = 0, total_cashback_earned = 0, total_cashback_used = 0;');
        return Response.json({ success: true });
      }
      if (op === 'cleanupTestWhatsapp') {
        const esc = (s) => String(s ?? '').replace(/'/g, "''");
        const key = await getServiceRoleKey(conn.accessToken, ref);
        const counts = { customers: 0, sales: 0, cashback_transactions: 0, cashback_redemptions: 0, notifications: 0, consent_records: 0, cashback_whatsapp: 0 };

        // Apaga registros de uma tabela com espelho nativo (mirrorDelete via legacy_id).
        async function purgeMirrored(table, whereSql) {
          const rows = await runSql(conn.accessToken, ref, `SELECT id FROM ${table} WHERE ${whereSql};`).catch(() => []);
          for (const r of rows || []) await mirrorDelete(base44, table, r.id);
          await runSql(conn.accessToken, ref, `DELETE FROM ${table} WHERE ${whereSql};`).catch(() => {});
          return (rows || []).length;
        }

        // 1. Localiza APENAS os clientes de teste da bateria de validação:
        //    nome padronizado + CPF fictício (prefixo 111/222/333). Nenhum cliente real é afetado.
        const testCustomers = await runSql(conn.accessToken, ref,
          "SELECT id, name FROM customers WHERE name LIKE 'Cliente Teste WP%' AND (cpf LIKE '111%' OR cpf LIKE '222%' OR cpf LIKE '333%');");

        for (const c of testCustomers || []) {
          const cid = esc(c.id);
          const cw = await runSql(conn.accessToken, ref,
            `DELETE FROM cashback_whatsapp WHERE cliente_id = '${cid}' RETURNING id;`).catch(() => []);
          counts.cashback_whatsapp += (cw || []).length;
          counts.consent_records += await purgeMirrored('consent_records', `customer_id = '${cid}'`);
          counts.notifications += await purgeMirrored('notifications', `customer_id = '${cid}'`);
          counts.cashback_transactions += await purgeMirrored('cashback_transactions', `customer_id = '${cid}'`);
          counts.cashback_redemptions += await purgeMirrored('cashback_redemptions', `customer_id = '${cid}'`);
          counts.sales += await purgeMirrored('sales', `customer_id = '${cid}' OR sale_number LIKE 'TSTWP-%'`);
          await mirrorDelete(base44, 'customers', c.id);
          await runSql(conn.accessToken, ref, `DELETE FROM customers WHERE id = '${cid}';`).catch(() => {});
          counts.customers++;
        }

        // 2. Registros órfãos de teste (vendas ou registros de WhatsApp sem cliente vinculado).
        counts.sales += await purgeMirrored('sales', `sale_number LIKE 'TSTWP-%'`);
        const orphanCw = await runSql(conn.accessToken, ref,
          "DELETE FROM cashback_whatsapp WHERE nome_cliente LIKE 'Cliente Teste WP%' RETURNING id;").catch(() => []);
        counts.cashback_whatsapp += (orphanCw || []).length;

        // 3. Auditoria da limpeza (histórico de auditoria é preservado).
        const audit = await pgInsert(key, ref, 'audit_logs', {
          user_id: user.id,
          user_name: user.full_name || user.email || 'Sistema',
          user_role: user.role,
          action: 'cleanup_test_data',
          entity_type: 'Customer',
          entity_id: '',
          description: `Limpeza de dados de teste: ${counts.customers} cliente(s), ${counts.sales} venda(s), ${counts.cashback_transactions} transação(ões), ${counts.cashback_redemptions} resgate(s), ${counts.notifications} notificação(ões), ${counts.consent_records} consentimento(s), ${counts.cashback_whatsapp} registro(s) de WhatsApp.`,
          is_demo: false,
          created_by_id: user.id,
        });
        await mirrorRow(base44, 'audit_logs', audit);
        return Response.json({ success: true, counts });
      }
      if (op === 'migrateTimezoneBrasilia') {
        // Converte os horários já gravados em UTC para o horário de Brasília (UTC-3)
        // e ajusta padrões/triggers para gravar em Brasília daqui em diante.
        // ATENÇÃO: executar apenas UMA vez — cada execução desloca 3h novamente.
        const tsCols = {
          customers: ['created_date', 'updated_date', 'data_consentimento', 'opt_out_em'],
          sales: ['created_date', 'updated_date'],
          cashback_transactions: ['created_date', 'updated_date'],
          cashback_redemptions: ['created_date', 'updated_date'],
          cashback_settings: ['created_date', 'updated_date'],
          product_categories: ['created_date', 'updated_date'],
          audit_logs: ['created_date', 'updated_date'],
          notifications: ['created_date', 'updated_date', 'sent_date'],
          consent_records: ['created_date', 'updated_date', 'consent_date'],
          internal_accounts: ['created_date', 'updated_date', 'last_login_at', 'locked_until'],
          staff_invitations: ['created_date', 'updated_date', 'invited_at', 'accepted_at'],
          cashback_whatsapp: [
            'created_date', 'updated_date', 'criado_em', 'atualizado_em',
            'data_consentimento', 'data_geracao_cashback', 'data_expiracao_cashback',
            'ultima_compra_em', 'ultima_mensagem_em', 'proxima_acao_em',
            'opt_out_em', 'ultima_tentativa_envio_em',
          ],
        };
        let shifted = 0;
        for (const [t, cols] of Object.entries(tsCols)) {
          for (const col of cols) {
            const r = await runSql(conn.accessToken, ref,
              `UPDATE ${t} SET ${col} = ${col} - interval '3 hours' WHERE ${col} IS NOT NULL RETURNING id;`
            ).catch(() => []);
            shifted += (r || []).length;
          }
          await runSql(conn.accessToken, ref,
            `ALTER TABLE ${t} ALTER COLUMN created_date SET DEFAULT (timezone('UTC', now() AT TIME ZONE 'America/Sao_Paulo'));`
          ).catch(() => {});
          await runSql(conn.accessToken, ref,
            `ALTER TABLE ${t} ALTER COLUMN updated_date SET DEFAULT (timezone('UTC', now() AT TIME ZONE 'America/Sao_Paulo'));`
          ).catch(() => {});
        }
        await runSql(conn.accessToken, ref,
          "ALTER TABLE cashback_whatsapp ALTER COLUMN criado_em SET DEFAULT (timezone('UTC', now() AT TIME ZONE 'America/Sao_Paulo'));"
        ).catch(() => {});
        await runSql(conn.accessToken, ref, `
          CREATE OR REPLACE FUNCTION set_updated_date() RETURNS trigger AS $$
          BEGIN NEW.updated_date = (timezone('UTC', now() AT TIME ZONE 'America/Sao_Paulo')); RETURN NEW; END;
          $$ LANGUAGE plpgsql;
          CREATE OR REPLACE FUNCTION set_atualizado_em() RETURNS trigger AS $$
          BEGIN NEW.atualizado_em = (timezone('UTC', now() AT TIME ZONE 'America/Sao_Paulo')); RETURN NEW; END;
          $$ LANGUAGE plpgsql;
        `).catch(() => {});
        return Response.json({ success: true, registros_ajustados: shifted });
      }
      // ===== Migração genérica: copia registros de uma entidade Base44 para a
      //       tabela correspondente no Supabase (idempotente por legacy_id). =====
      async function migrateEntity(entityName, table, mapRow) {
        const all = await base44.asServiceRole.entities[entityName].list('-created_date', 2000);
        const key = await getServiceRoleKey(conn.accessToken, ref);
        let inserted = 0, skipped = 0;
        for (const r of all) {
          const existing = await pgList(key, ref, table, { filters: { legacy_id: r.id }, limit: 1 });
          if (existing && existing.length > 0) { skipped++; continue; }
          const row = { ...mapRow(r), legacy_id: r.id, created_date: r.created_date, created_by_id: r.created_by_id || '' };
          await pgInsert(key, ref, table, row);
          inserted++;
        }
        return { inserted, skipped, total: all.length };
      }

      const MAPS = {
        CashbackSettings: (c) => ({
          cashback_percentage: c.cashback_percentage ?? 5, min_purchase_to_use: c.min_purchase_to_use ?? 50,
          max_cashback_payment_percentage: c.max_cashback_payment_percentage ?? 50,
          release_days: c.release_days ?? 0, balance_validity_days: c.balance_validity_days ?? 365,
          is_active: c.is_active !== false, program_name: c.program_name || 'Vem Pra K Cashback',
          terms_text: c.terms_text || '', privacy_text: c.privacy_text || '', updated_by: c.updated_by || '',
        }),
        ProductCategory: (c) => ({
          name: c.name, generates_cashback: c.generates_cashback !== false,
          can_use_cashback: c.can_use_cashback !== false,
          cashback_percentage_override: c.cashback_percentage_override ?? null,
          description: c.description || '', is_active: c.is_active !== false,
        }),
        AuditLog: (c) => ({
          user_id: c.user_id || '', user_name: c.user_name || '', user_role: c.user_role || '',
          action: c.action, entity_type: c.entity_type || '', entity_id: c.entity_id || '',
          description: c.description, justification: c.justification || '',
          before_data: c.before_data || '', after_data: c.after_data || '',
          ip_address: c.ip_address || '', is_demo: !!c.is_demo,
        }),
        StaffInvitation: (c) => ({
          full_name: c.full_name, email: c.email || '', phone: c.phone || '', job_title: c.job_title || '',
          role: c.role || 'cashier', status: c.status || 'pending',
          invited_by: c.invited_by || '', invited_at: c.invited_at || null, accepted_at: c.accepted_at || null,
        }),
        Customer: (c) => ({
          name: c.name, phone: c.phone, email: c.email || '', cpf: c.cpf || '',
          identifier_code: c.identifier_code || '', accepts_promotions: !!c.accepts_promotions,
          available_balance: c.available_balance || 0, pending_balance: c.pending_balance || 0,
          total_cashback_earned: c.total_cashback_earned || 0, total_cashback_used: c.total_cashback_used || 0,
          is_demo: !!c.is_demo, is_active: c.is_active !== false, notes: c.notes || '',
        }),
        InternalAccount: (c) => ({
          username: c.username, full_name: c.full_name, email: c.email || '', phone: c.phone || '',
          cpf: c.cpf || '', job_title: c.job_title || '', role: c.role || 'cashier',
          password_hash: c.password_hash, password_salt: c.password_salt,
          status: c.status || 'active', linked_customer_id: c.linked_customer_id || '',
          last_login_at: c.last_login_at || null, failed_attempts: c.failed_attempts || 0,
          locked_until: c.locked_until || null, notes: c.notes || '',
        }),
      };

      if (op === 'migrateSettings')
        return Response.json({ success: true, result: await migrateEntity('CashbackSettings', 'cashback_settings', MAPS.CashbackSettings) });
      if (op === 'migrateCategories')
        return Response.json({ success: true, result: await migrateEntity('ProductCategory', 'product_categories', MAPS.ProductCategory) });
      if (op === 'migrateAuditLogs')
        return Response.json({ success: true, result: await migrateEntity('AuditLog', 'audit_logs', MAPS.AuditLog) });
      if (op === 'migrateStaffInvitations')
        return Response.json({ success: true, result: await migrateEntity('StaffInvitation', 'staff_invitations', MAPS.StaffInvitation) });

      if (op === 'migrateAll') {
        const r = {
          customers: await migrateEntity('Customer', 'customers', MAPS.Customer),
          internal_accounts: await migrateEntity('InternalAccount', 'internal_accounts', MAPS.InternalAccount),
          settings: await migrateEntity('CashbackSettings', 'cashback_settings', MAPS.CashbackSettings),
          categories: await migrateEntity('ProductCategory', 'product_categories', MAPS.ProductCategory),
          audit_logs: await migrateEntity('AuditLog', 'audit_logs', MAPS.AuditLog),
          staff_invitations: await migrateEntity('StaffInvitation', 'staff_invitations', MAPS.StaffInvitation),
        };
        return Response.json({ success: true, migrations: r });
      }

      if (op === 'migrateInternalAccounts') {
        const all = await base44.asServiceRole.entities.InternalAccount.list('-created_date', 1000);
        const key = await getServiceRoleKey(conn.accessToken, ref);
        let inserted = 0;
        let skipped = 0;
        for (const a of all) {
          const existing = await pgList(key, ref, 'internal_accounts', { filters: { legacy_id: a.id }, limit: 1 });
          if (existing && existing.length > 0) { skipped++; continue; }
          await pgInsert(key, ref, 'internal_accounts', {
            legacy_id: a.id,
            username: a.username, full_name: a.full_name, email: a.email || '',
            phone: a.phone || '', cpf: a.cpf || '', job_title: a.job_title || '',
            role: a.role || 'cashier',
            password_hash: a.password_hash, password_salt: a.password_salt,
            status: a.status || 'active', linked_customer_id: a.linked_customer_id || '',
            last_login_at: a.last_login_at || null,
            failed_attempts: a.failed_attempts || 0, locked_until: a.locked_until || null,
            notes: a.notes || '',
            created_date: a.created_date, created_by_id: a.created_by_id || '',
          });
          inserted++;
        }
        return Response.json({ success: true, inserted, skipped, total: all.length });
      }
      // migrateCustomers: copia clientes do Base44 para o Supabase (idempotente por legacy_id).
      const all = await base44.asServiceRole.entities.Customer.list('-created_date', 1000);
      const key = await getServiceRoleKey(conn.accessToken, ref);
      let inserted = 0;
      let skipped = 0;
      for (const c of all) {
        const existing = await pgList(key, ref, 'customers', { filters: { legacy_id: c.id }, limit: 1 });
        if (existing && existing.length > 0) { skipped++; continue; }
        await pgInsert(key, ref, 'customers', {
          legacy_id: c.id,
          name: c.name, phone: c.phone, email: c.email || '', cpf: c.cpf || '',
          identifier_code: c.identifier_code || '',
          accepts_promotions: !!c.accepts_promotions,
          available_balance: c.available_balance || 0,
          pending_balance: c.pending_balance || 0,
          total_cashback_earned: c.total_cashback_earned || 0,
          total_cashback_used: c.total_cashback_used || 0,
          is_demo: !!c.is_demo, is_active: c.is_active !== false,
          notes: c.notes || '',
          created_date: c.created_date, created_by_id: c.created_by_id || '',
        });
        inserted++;
      }
      return Response.json({ success: true, inserted, skipped, total: all.length });
    }

    // ===== CRUD genérico (autenticado, tabelas permitidas) =====
    if (!table || !CRUD_TABLES.has(table)) {
      return Response.json({ error: 'Tabela não permitida.' }, { status: 400 });
    }
    const key = await getServiceRoleKey(conn.accessToken, ref);

    if (op === 'list') {
      const rows = await pgList(key, ref, table, {
        filters: body.filters, sort: body.sort, limit: body.limit, offset: body.offset,
      });
      return Response.json({ data: rows });
    }
    if (op === 'filter') {
      const rows = await pgList(key, ref, table, { filters: body.query, sort: body.sort, limit: body.limit });
      return Response.json({ data: rows });
    }
    if (op === 'count') {
      const total = await pgCount(key, ref, table, body.filters || body.query);
      return Response.json({ data: total });
    }
    if (op === 'search') {
      const rows = await pgSearch(key, ref, table, {
        q: body.q, columns: body.columns || ['name'],
        extraFilters: body.extra_filters, sort: body.sort, limit: body.limit || 20,
      });
      return Response.json({ data: rows });
    }
    if (op === 'get') {
      const row = await pgGet(key, ref, table, body.id);
      return Response.json({ data: row });
    }
    if (op === 'create') {
      const data = { ...body.data };
      if (!data.created_by_id) data.created_by_id = user.id;
      if (table === 'customers') {
        // Consentimentos: promocoes_opt_in acompanha o campo legado accepts_promotions;
        // cashback_comunicacao_opt_in é independente (default false).
        if (data.promocoes_opt_in === undefined) data.promocoes_opt_in = !!data.accepts_promotions;
        if (data.cashback_comunicacao_opt_in === undefined) data.cashback_comunicacao_opt_in = false;
        if ((data.promocoes_opt_in || data.cashback_comunicacao_opt_in) && !data.data_consentimento) {
          data.data_consentimento = nowBrasilia();
          data.origem_consentimento = data.origem_consentimento || 'painel';
        }
      }
      const row = await pgInsert(key, ref, table, data);
      await mirrorRow(base44, table, row);
      if (table === 'customers') {
        // Registro inicial dos dois consentimentos para auditoria (LGPD).
        const cr1 = await recordConsent(key, ref, row.id, row.name, 'comunicacoes_promocionais', row.promocoes_opt_in);
        if (cr1) await mirrorRow(base44, 'consent_records', cr1);
        const cr2 = await recordConsent(key, ref, row.id, row.name, 'comunicacoes_cashback', row.cashback_comunicacao_opt_in);
        if (cr2) await mirrorRow(base44, 'consent_records', cr2);
      }
      return Response.json({ data: row });
    }
    if (op === 'update') {
      const data = { ...body.data };
      if (table === 'customers' && data.accepts_promotions !== undefined && data.promocoes_opt_in === undefined) {
        // Mantém promocoes_opt_in em sincronia com o campo legado do formulário.
        data.promocoes_opt_in = !!data.accepts_promotions;
      }
      // Estado anterior dos consentimentos (para registrar alterações/opt-out).
      const prev = table === 'customers'
        ? await pgGet(key, ref, 'customers', body.id).catch(() => null)
        : null;
      const row = await pgUpdate(key, ref, table, body.id, data);
      await mirrorRow(base44, table, row);

      // Modo piloto alterado no painel → recalcula a elegibilidade de envio
      // (status_telefone) de todos os registros ativos na tabela do WhatsApp.
      let pilotoRecalc = null;
      if (table === 'cashback_settings' && (data.piloto_ativo !== undefined || data.piloto_telefones !== undefined)) {
        pilotoRecalc = await recomputePilotStatus(conn.accessToken, key, ref).catch(() => null);
      }

      if (table === 'customers' && row) {
        const hasConsentFields =
          data.accepts_promotions !== undefined || data.promocoes_opt_in !== undefined ||
          data.cashback_comunicacao_opt_in !== undefined;
        if (hasConsentFields) {
          const prevPromo = prev ? !!(prev.promocoes_opt_in ?? prev.accepts_promotions) : !!row.promocoes_opt_in;
          const prevCash = prev ? !!prev.cashback_comunicacao_opt_in : !!row.cashback_comunicacao_opt_in;
          const newPromo = !!row.promocoes_opt_in;
          const newCash = !!row.cashback_comunicacao_opt_in;

          if (newPromo !== prevPromo) {
            const cr = await recordConsent(key, ref, row.id, row.name, 'comunicacoes_promocionais', newPromo);
            if (cr) await mirrorRow(base44, 'consent_records', cr);
          }
          if (newCash !== prevCash) {
            const cr = await recordConsent(key, ref, row.id, row.name, 'comunicacoes_cashback', newCash);
            if (cr) await mirrorRow(base44, 'consent_records', cr);
          }

          const patch = {};
          if ((prevPromo && !newPromo) || (prevCash && !newCash)) {
            // Retirada de autorização → registra o opt-out.
            patch.opt_out_em = nowBrasilia();
          } else if ((!prevPromo && newPromo) || (!prevCash && newCash)) {
            // Nova autorização → data/origem do consentimento; limpa opt-out anterior.
            patch.opt_out_em = null;
            patch.data_consentimento = nowBrasilia();
            patch.origem_consentimento = 'painel';
          }
          let finalRow = row;
          if (Object.keys(patch).length > 0) {
            finalRow = await pgUpdate(key, ref, 'customers', row.id, patch);
            await mirrorRow(base44, 'customers', finalRow);
          }
          // Propaga a preferência atual para os registros ATIVOS em cashback_whatsapp
          // (histórico antigo preservado) — consulta futura do n8n.
          await syncConsentsToWhatsapp(conn.accessToken, key, ref, row.id).catch(() => {});
          return Response.json({ data: finalRow });
        }
      }

      if (table === 'sales' && data.status && ['cancelada', 'devolvida'].includes(data.status)) {
        // Cancelamento/reversão de venda: marca o registro operacional correspondente.
        await cancelWhatsappBySale(conn.accessToken, ref, body.id).catch(() => {});
      }
      return Response.json({ data: row, ...(pilotoRecalc ? { piloto_recalc: pilotoRecalc } : {}) });
    }
    if (op === 'delete') {
      await pgDelete(key, ref, table, body.id);
      await mirrorDelete(base44, table, body.id);
      return Response.json({ data: { success: true } });
    }

    return Response.json({ error: 'Operação inválida.' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}