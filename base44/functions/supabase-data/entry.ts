import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import {
  getConnection, getProjectRef, ensureTables, listTables,
  getServiceRoleKey, pgList, pgGet, pgInsert, pgUpdate, pgDelete, runSql,
} from '../../shared/supabase.ts';

// Tabelas permitidas para CRUD genérico via esta função.
// Todas as entidades do app agora vivem no Supabase; o Base44 funciona apenas como backup.
const CRUD_TABLES = new Set([
  'customers', 'sales', 'cashback_transactions', 'cashback_redemptions',
  'internal_accounts', 'cashback_settings', 'product_categories',
  'audit_logs', 'staff_invitations', 'notifications', 'consent_records',
]);

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { op, table } = body;

    const conn = await getConnection(base44);
    const ref = await getProjectRef(conn.accessToken);

    // ===== Operações administrativas (setup / saúde / migração) =====
    if (op === 'setup' || op === 'health' || op === 'listTables' || op === 'migrateAll' || op === 'migrateCustomers' || op === 'migrateInternalAccounts' || op === 'migrateSettings' || op === 'migrateCategories' || op === 'migrateAuditLogs' || op === 'migrateStaffInvitations' || op === 'resetCustomerBalances') {
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
    if (op === 'get') {
      const row = await pgGet(key, ref, table, body.id);
      return Response.json({ data: row });
    }
    if (op === 'create') {
      const data = { ...body.data };
      if (!data.created_by_id) data.created_by_id = user.id;
      const row = await pgInsert(key, ref, table, data);
      return Response.json({ data: row });
    }
    if (op === 'update') {
      const row = await pgUpdate(key, ref, table, body.id, body.data);
      return Response.json({ data: row });
    }
    if (op === 'delete') {
      await pgDelete(key, ref, table, body.id);
      return Response.json({ data: { success: true } });
    }

    return Response.json({ error: 'Operação inválida.' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}