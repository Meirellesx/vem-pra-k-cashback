import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import {
  getConnection, getProjectRef, ensureTables, listTables,
  getServiceRoleKey, pgList, pgGet, pgInsert, pgUpdate, pgDelete, runSql,
} from '../../shared/supabase.ts';

// Tabelas permitidas para CRUD genérico via esta função.
// (Expande conforme cada entidade é migrada para o Supabase.)
const CRUD_TABLES = new Set(['customers', 'sales', 'cashback_transactions', 'cashback_redemptions']);

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
    if (op === 'setup' || op === 'health' || op === 'listTables' || op === 'migrateCustomers' || op === 'resetCustomerBalances') {
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