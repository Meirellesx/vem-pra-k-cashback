import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { formatCurrency, formatDate } from '@/lib/cashbackUtils';
import { getDashboardStats } from '@/lib/statsDb';
import { Users, ShoppingCart, TrendingUp, Wallet, Clock, AlertTriangle, ArrowUpRight, ArrowDownRight } from 'lucide-react';

function StatCard({ title, value, subtitle, icon: Icon, color, trend }) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
        {trend !== undefined && (
          <span className={`flex items-center text-xs font-semibold ${trend >= 0 ? 'text-green-600' : 'text-red-500'}`}>
            {trend >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {Math.abs(trend)}%
          </span>
        )}
      </div>
      <div className="text-2xl font-black text-gray-900 mb-1">{value}</div>
      <div className="text-sm font-semibold text-gray-700">{title}</div>
      {subtitle && <div className="text-xs text-gray-400 mt-0.5">{subtitle}</div>}
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [recentSales, setRecentSales] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const s = await getDashboardStats();
      setStats({
        totalCustomers: s.totalCustomers || 0,
        totalSales: s.totalSales || 0,
        todaySalesCount: s.todaySalesCount || 0,
        todaySalesValue: s.todaySalesValue || 0,
        totalCashbackGenerated: s.totalCashbackGenerated || 0,
        totalCashbackUsed: s.totalCashbackUsed || 0,
        pendingBalance: s.pendingBalance || 0,
        availableBalance: s.availableBalance || 0,
      });
      setRecentSales(s.recentSales || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-black text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Bem-vindo, {user?.full_name}! Aqui está o resumo do programa.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard title="Clientes" value={stats?.totalCustomers || 0} subtitle="Cadastrados" icon={Users} color="bg-blue-100 text-blue-600" />
        <StatCard title="Vendas Hoje" value={stats?.todaySalesCount || 0} subtitle={formatCurrency(stats?.todaySalesValue)} icon={ShoppingCart} color="bg-green-100 text-green-600" />
        <StatCard title="Saldo Disponível" value={formatCurrency(stats?.availableBalance)} subtitle="Na carteira dos clientes" icon={Wallet} color="bg-orange-100 text-orange-600" />
        <StatCard title="Saldo Pendente" value={formatCurrency(stats?.pendingBalance)} subtitle="Aguardando liberação" icon={Clock} color="bg-yellow-100 text-yellow-600" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <StatCard title="Cashback Gerado (Total)" value={formatCurrency(stats?.totalCashbackGenerated)} icon={TrendingUp} color="bg-purple-100 text-purple-600" />
        <StatCard title="Cashback Utilizado (Total)" value={formatCurrency(stats?.totalCashbackUsed)} icon={Wallet} color="bg-teal-100 text-teal-600" />
        <StatCard title="Total de Vendas" value={stats?.totalSales || 0} subtitle="Concluídas" icon={ShoppingCart} color="bg-indigo-100 text-indigo-600" />
      </div>

      {/* Recent sales */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h2 className="font-bold text-gray-900 mb-4">Vendas Recentes</h2>
        {recentSales.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <ShoppingCart className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Nenhuma venda registrada ainda</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left text-gray-500 font-semibold pb-3">Venda</th>
                  <th className="text-left text-gray-500 font-semibold pb-3">Cliente</th>
                  <th className="text-right text-gray-500 font-semibold pb-3">Valor</th>
                  <th className="text-right text-gray-500 font-semibold pb-3">Cashback</th>
                  <th className="text-left text-gray-500 font-semibold pb-3">Data</th>
                </tr>
              </thead>
              <tbody>
                {recentSales.map(s => (
                  <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="py-3 font-mono text-gray-700">#{s.sale_number}</td>
                    <td className="py-3 text-gray-700">{s.customer_name || '—'}</td>
                    <td className="py-3 text-right font-semibold text-gray-900">{formatCurrency(s.total_amount)}</td>
                    <td className="py-3 text-right text-green-600 font-semibold">{formatCurrency(s.cashback_amount)}</td>
                    <td className="py-3 text-gray-500">{formatDate(s.sale_date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}