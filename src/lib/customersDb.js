import { base44 } from '@/api/base44Client';

// Adaptador que espelha a interface base44.entities.Customer, mas lê/gravando
// no Supabase (projeto "Cashback") via a função de backend `supabase-data`.
// Permite trocar a origem dos dados de Cliente do Base44 para o Supabase sem
// alterar a lógica das telas.

const unwrap = (res) => {
  const payload = res?.data ?? res;
  if (payload?.error) throw new Error(payload.error);
  return payload?.data ?? payload ?? [];
};

export const Customer = {
  list: async (sort = '-created_date', limit = 1000) => {
    const res = await base44.functions.invoke('supabase-data', {
      table: 'customers', op: 'list', sort, limit,
    });
    return unwrap(res) || [];
  },
  filter: async (query, sort, limit = 1000) => {
    const res = await base44.functions.invoke('supabase-data', {
      table: 'customers', op: 'filter', query, sort, limit,
    });
    return unwrap(res) || [];
  },
  get: async (id) => {
    const res = await base44.functions.invoke('supabase-data', {
      table: 'customers', op: 'get', id,
    });
    return unwrap(res);
  },
  create: async (data) => {
    const res = await base44.functions.invoke('supabase-data', {
      table: 'customers', op: 'create', data,
    });
    return unwrap(res);
  },
  update: async (id, data) => {
    const res = await base44.functions.invoke('supabase-data', {
      table: 'customers', op: 'update', id, data,
    });
    return unwrap(res);
  },
  delete: async (id) => {
    const res = await base44.functions.invoke('supabase-data', {
      table: 'customers', op: 'delete', id,
    });
    return unwrap(res);
  },
};

export default Customer;