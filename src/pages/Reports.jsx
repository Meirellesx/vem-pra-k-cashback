import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import Customer from '@/lib/customersDb';
import Sale from '@/lib/salesDb';
import CashbackTransaction from '@/lib/cashbackTransactionsDb';
import { formatCurrency, formatDate, exportToCSV } from '@/lib/cashbackUtils';
import { BarChart3, Download, TrendingUp, Wallet, Clock, XCircle, ShoppingCart } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

const COLORS = ['#FF6B00', '#22c55e', '#3b82f6', '#f59e0b', '#ef4444'];

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
      const [sales, transactions, customers] = await Promise.all([
        Sale.filter({ is_demo: false }),
        CashbackTransaction.filter({ is_demo: false }),
        Customer.filter({ is_demo: false }),
      ]);

      const now = new Date();
      const startDate = new Date();
      if (period === 'week') startDate.setDate(now.getDate() - 7);
      else if (period === 'month') startDate.setMonth(now.getMonth() - 1);
      else if (period === 'quarter') startDate.setMonth(now.getMonth() - 3);
      else startDate.setFullYear(now.getFullYear() - 1);

      const filteredSales = sales.filter(s => new Date(s.sale_date) >= startDate && s.status === 'concluida');
      const filteredTx = transactions.filter(t => new Date(t.transaction_date) >= startDate);

      const generated = filteredTx.filter(t => t.type === 'gerado');
      const used = filteredTx.filter(t => t.type === 'utilizado');
      const expired = filteredTx.filter(t => t.status === 'expirado');
      const pending = transactions.filter(t => t.status === 'pendente');
      const available = customers.reduce((a, b) => a + (b.available_balance || 0), 0);

      // Monthly chart data
      const monthlyMap = {};
      filteredSales.forEach(s => {
        const month = s.sale_date?.slice(0, 7) || '';
        if (!monthlyMap[month]) monthlyMap[month] = { month, vendas: 0, cashback: 0 };
        monthlyMap[month].vendas += s.total_amount || 0;
        monthlyMap[month].cashback += s.cashback_amount || 0;
      });
      const chartData = Object.values(monthlyMap).sort((a, b) => a.month.localeCompare(b.month)).slice(-12);

      // Payment method pie
      const pmMap = {};
      filteredSales.forEach(s => {
        pmMap[s.payment_method] = (pmMap[s.payment_method] || 0) + 1;
      });
      const pieData = Object.entries(pmMap).map(([name, value]) => ({ name, value }));

      setData({
        totalSales: filteredSales.length,
        totalSalesValue: filteredSales.reduce((a, b) => a + (b.total_amount || 0), 0),
        cashbackGenerated: generated.reduce((a, b) => a + Math.abs(b.amount || 0), 0),
        cashbackUsed: Math.abs(used.reduce((a, b) => a + (b.amount || 0), 0)),
        cashbackExpired: expired.reduce((a, b) => a + Math.abs(b.amount || 0), 0),
        pendingBalance: pending.reduce((a, b) => a + (b.amount || 0), 0),
        availableBalance: available,
        chartData,
        pieData,
        allSales: filteredSales,
        allTransactions: filteredTx,
      });
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const exportSales = () => {
    if (!data?.allSales) return;
    exportToCSV(data.allSales, 'vendas.csv', [
      { key: 'sale_number', label: 'Número' },
      { key: 'customer_name', label: 'Cliente' },
      { key: 'total_amount', label: 'Valor Total' },
      { key: 'cashback_amount', label: 'Cashback Gerado' },
      { key: 'payment_method', label: 'Pagamento' },
      { key: 'sale_date', label: 'Data' },
      { key: 'status', label: 'Status' },
    ]);
  };

  const exportTransactions = () => {
    if (!data?.allTransactions) return;
    exportToCSV(data.allTransactions, 'movimentacoes.csv', [
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