import React, { useState, useEffect } from 'react';
import Sale from '@/lib/salesDb';
import CashbackTransaction from '@/lib/cashbackTransactionsDb';
import { formatCurrency, formatDate, exportToCSV } from '@/lib/cashbackUtils';
import { getReportStats } from '@/lib/statsDb';
import { BarChart3, Download, TrendingUp, Wallet, Clock, XCircle, ShoppingCart } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

const COLORS = ['#FF6B00', '#22c55e', '#3b82f6', '#f59e0b', '#ef4444'];

// Data inicial do período selecionado.
const periodStart = (period) => {
  const now = new Date();
  const d = new Date();
  if (period === 'week') d.setDate(now.getDate() - 7);
  else if (period === 'month') d.setMonth(now.getMonth() - 1);
  else if (period === 'quarter') d.setMonth(now.getMonth() - 3);
  else d.setFullYear(now.getFullYear() - 1);
  return d;
};

function SummaryCard({ title, value, icon: Icon, color }) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="text-xl font-black text-gray-900">{value}</div>
      <div className="text-sm text-gray-500 mt-0.5">{title}</div>
    </div>
  );
}

export default function Reports() {
  const [period, setPeriod] = useState('month');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, [period]);

  const loadData = async () => {
    setLoading(true);
    try {
      const startStr = periodStart(period).toISOString().split('T')[0];
      const s = await getReportStats(startStr);
      setData({
        totalSales: s.totalSales || 0,
        totalSalesValue: s.totalSalesValue || 0,
        cashbackGenerated: s.cashbackGenerated || 0,
        cashbackUsed: s.cashbackUsed || 0,
        cashbackExpired: s.cashbackExpired || 0,
        pendingBalance: s.pendingBalance || 0,
        availableBalance: s.availableBalance || 0,
        chartData: s.chartData || [],
        pieData: s.pieData || [],
      });
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const exportSales = async () => {
    const startDate = periodStart(period);
    const all = await Sale.filter({ is_demo: false });
    const rows = (all || []).filter(s => new Date(s.sale_date) >= startDate && s.status === 'concluida');
    exportToCSV(rows, 'vendas.csv', [
      { key: 'sale_number', label: 'Número' },
      { key: 'customer_name', label: 'Cliente' },
      { key: 'total_amount', label: 'Valor Total' },
      { key: 'cashback_amount', label: 'Cashback Gerado' },
      { key: 'payment_method', label: 'Pagamento' },
      { key: 'sale_date', label: 'Data' },
      { key: 'status', label: 'Status' },
    ]);
  };

  const exportTransactions = async () => {
    const startDate = periodStart(period);
    const all = await CashbackTransaction.filter({ is_demo: false });
    const rows = (all || []).filter(t => new Date(t.transaction_date) >= startDate);
    exportToCSV(rows, 'movimentacoes.csv', [
      { key: 'customer_name', label: 'Cliente' },
      { key: 'sale_number', label: 'Venda' },
      { key: 'amount', label: 'Valor' },
      { key: 'type', label: 'Tipo' },
      { key: 'status', label: 'Status' },
      { key: 'transaction_date', label: 'Data' },
    ]);
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Relatórios</h1>
          <p className="text-gray-500 text-sm">Visão consolidada do programa de cashback</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportSales} className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-50">
            <Download className="w-3.5 h-3.5" /> Vendas CSV
          </button>
          <button onClick={exportTransactions} className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-50">
            <Download className="w-3.5 h-3.5" /> Movimentações CSV
          </button>
        </div>
      </div>

      {/* Period selector */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {[['week', '7 dias'], ['month', '30 dias'], ['quarter', '3 meses'], ['year', '12 meses']].map(([v, l]) => (
          <button key={v} onClick={() => setPeriod(v)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${period === v ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20' : 'bg-white border border-gray-200 text-gray-600 hover:border-orange-300'}`}>
            {l}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40"><div className="w-8 h-8 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin" /></div>
      ) : !data ? null : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <SummaryCard title="Vendas" value={data.totalSales} icon={ShoppingCart} color="bg-blue-100 text-blue-600" />
            <SummaryCard title="Valor em Vendas" value={formatCurrency(data.totalSalesValue)} icon={TrendingUp} color="bg-green-100 text-green-600" />
            <SummaryCard title="Cashback Gerado" value={formatCurrency(data.cashbackGenerated)} icon={Wallet} color="bg-orange-100 text-orange-600" />
            <SummaryCard title="Cashback Utilizado" value={formatCurrency(data.cashbackUsed)} icon={Wallet} color="bg-blue-100 text-blue-600" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <SummaryCard title="Cashback Expirado" value={formatCurrency(data.cashbackExpired)} icon={XCircle} color="bg-gray-100 text-gray-500" />
            <SummaryCard title="Saldo Pendente" value={formatCurrency(data.pendingBalance)} icon={Clock} color="bg-yellow-100 text-yellow-600" />
            <SummaryCard title="Saldo Disponível (Total)" value={formatCurrency(data.availableBalance)} icon={Wallet} color="bg-green-100 text-green-600" />
          </div>

          {data.chartData.length > 0 && (
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6">
              <h2 className="font-bold text-gray-900 mb-4">Vendas x Cashback por Período</h2>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={data.chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => formatCurrency(v)} />
                  <Bar dataKey="vendas" fill="#FF6B00" radius={[4,4,0,0]} name="Vendas" />
                  <Bar dataKey="cashback" fill="#22c55e" radius={[4,4,0,0]} name="Cashback" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {data.pieData.length > 0 && (
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h2 className="font-bold text-gray-900 mb-4">Formas de Pagamento</h2>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={data.pieData} cx="50%" cy="50%" outerRadius={80} dataKey="value" nameKey="name">
                    {data.pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </div>
  );
}