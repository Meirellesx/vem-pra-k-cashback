import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { getConnection, getProjectRef, ensureTables, listTables } from '../../shared/supabase.ts';

// Função administrativa de setup/saúde do banco Supabase (projeto "Cashback").
// Apenas admins podem executar.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden — apenas administradores.' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const { op } = body;

    const conn = await getConnection(base44);
    const ref = await getProjectRef(conn.accessToken);

    if (op === 'setup') {
      const tables = await ensureTables(conn.accessToken, ref);
      return Response.json({ success: true, project_ref: ref, tables });
    }

    if (op === 'health' || op === 'listTables') {
      const tables = await listTables(conn.accessToken, ref);
      return Response.json({ success: true, project_ref: ref, tables });
    }

    return Response.json({ error: 'Operação inválida. Use: setup | health.' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}