import { base44 } from '@/api/base44Client';

// Agregações server-side (Postgres faz SUM/COUNT/GROUP BY numa chamada só),
// via a RPC allowlisted na função de backend `supabase-data`.

const unwrap = (res) => {
  const payload = res?.data ?? res;
  if (payload?.error) throw new Error(payload.error);
  return payload?.data ?? payload ?? null;
};

// Todos os números da tela Dashboard + as 5 vendas mais recentes.
export const getDashboardStats = async () => {
  const res = await base44.functions.invoke('supabase-data', { op: 'rpc', fn: 'dashboard_stats' });
  return unwrap(res) || {};
};

// Todos os números da tela Relatórios para o período (a partir de startDate 'YYYY-MM-DD').
export const getReportStats = async (startDate) => {
  const res = await base44.functions.invoke('supabase-data', {
    op: 'rpc', fn: 'report_stats', args: { p_start: startDate },
  });
  return unwrap(res) || {};
};
