import { base44 } from '@/api/base44Client';

// Adaptador que espelha a interface base44.entities.InternalAccount, mas
// lê/gravando no Supabase (projeto "Cashback") via a função `supabase-data`.
// A escrita (create/update/delete) continua feita pela função
// `internal-account-manage`, que agora também aponta para o Supabase.

const unwrap = (res) => {
  const payload = res?.data ?? res;
  if (payload?.error) throw new Error(payload.error);
  return payload?.data ?? payload ?? [];
};

export const InternalAccount = {
  list: async (sort = '-created_date', limit = 1000) => {
    const res = await base44.functions.invoke('supabase-data', {
      table: 'internal_accounts', op: 'list', sort, limit,
    });
    return unwrap(res) || [];
  },
  filter: async (query, sort, limit = 1000) => {
    const res = await base44.functions.invoke('supabase-data', {
      table: 'internal_accounts', op: 'filter', query, sort, limit,
    });
    return unwrap(res) || [];
  },
};

export default InternalAccount;