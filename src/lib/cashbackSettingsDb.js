import { base44 } from '@/api/base44Client';

// Adaptador que espelha base44.entities.CashbackSettings, lendo/gravando
// no Supabase (projeto "Cashback") via a função de backend `supabase-data`.

const unwrap = (res) => {
  const payload = res?.data ?? res;
  if (payload?.error) throw new Error(payload.error);
  return payload?.data ?? payload ?? [];
};

export const CashbackSettings = {
  list: async (sort = '-created_date', limit = 1000) => {
    const res = await base44.functions.invoke('supabase-data', {
      table: 'cashback_settings', op: 'list', sort, limit,
    });
    return unwrap(res) || [];
  },
  get: async (id) => {
    const res = await base44.functions.invoke('supabase-data', {
      table: 'cashback_settings', op: 'get', id,
    });
    return unwrap(res);
  },
  create: async (data) => {
    const res = await base44.functions.invoke('supabase-data', {
      table: 'cashback_settings', op: 'create', data,
    });
    return unwrap(res);
  },
  update: async (id, data) => {
    const res = await base44.functions.invoke('supabase-data', {
      table: 'cashback_settings', op: 'update', id, data,
    });
    return unwrap(res);
  },
};

export default CashbackSettings;