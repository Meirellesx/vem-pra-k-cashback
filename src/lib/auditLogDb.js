import { base44 } from '@/api/base44Client';

// Adaptador que espelha base44.entities.AuditLog, lendo/gravando no Supabase
// (projeto "Cashback") via a função de backend `supabase-data`.

const unwrap = (res) => {
  const payload = res?.data ?? res;
  if (payload?.error) throw new Error(payload.error);
  return payload?.data ?? payload ?? [];
};

export const AuditLog = {
  list: async (sort = '-created_date', limit = 1000) => {
    const res = await base44.functions.invoke('supabase-data', {
      table: 'audit_logs', op: 'list', sort, limit,
    });
    return unwrap(res) || [];
  },
  filter: async (query, sort, limit = 1000) => {
    const res = await base44.functions.invoke('supabase-data', {
      table: 'audit_logs', op: 'filter', query, sort, limit,
    });
    return unwrap(res) || [];
  },
  create: async (data) => {
    const res = await base44.functions.invoke('supabase-data', {
      table: 'audit_logs', op: 'create', data,
    });
    return unwrap(res);
  },
};

export default AuditLog;