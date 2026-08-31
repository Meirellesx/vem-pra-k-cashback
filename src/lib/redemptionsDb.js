import { base44 } from '@/api/base44Client';

// Adaptador que espelha a interface base44.entities.CashbackRedemption,
// mas lê/gravando no Supabase (projeto "Cashback") via `supabase-data`.

const unwrap = (res) => {
  const payload = res?.data ?? res;
  if (payload?.error) throw new Error(payload.error);
  return payload?.data ?? payload ?? [];
};

export const CashbackRedemption = {
  list: async (sort = '-created_date', limit = 1000) => {
    const res = await base44.functions.invoke('supabase-data', {
      table: 'cashback_redemptions', op: 'list', sort, limit,
    });
    return unwrap(res) || [];
  },
  filter: async (query, sort, limit = 1000) => {
    const res = await base44.functions.invoke('supabase-data', {
      table: 'cashback_redemptions', op: 'filter', query, sort, limit,
    });
    return unwrap(res) || [];
  },
  get: async (id) => {
    const res = await base44.functions.invoke('supabase-data', {
      table: 'cashback_redemptions', op: 'get', id,
    });
    return unwrap(res);
  },
  create: async (data) => {
    const res = await base44.functions.invoke('supabase-data', {
      table: 'cashback_redemptions', op: 'create', data,
    });
    return unwrap(res);
  },
  update: async (id, data) => {
    const res = await base44.functions.invoke('supabase-data', {
      table: 'cashback_redemptions', op: 'update', id, data,
    });
    return unwrap(res);
  },
  delete: async (id) => {
    const res = await base44.functions.invoke('supabase-data', {
      table: 'cashback_redemptions', op: 'delete', id,
    });
    return unwrap(res);
  },
};

export default CashbackRedemption;