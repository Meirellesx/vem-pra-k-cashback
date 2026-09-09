import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import Customer from '@/lib/customersDb';
import CashbackTransaction from '@/lib/cashbackTransactionsDb';
import { useAuth } from '@/lib/AuthContext';
import { formatCurrency, formatDate, exportToCSV, getCustomerForUser } from '@/lib/cashbackUtils';
import { FileText, Download, Filter, RefreshCw } from 'lucide-react';
import StatusBadge from '@/components/ui/StatusBadge';
import DrawerSelect from '@/components/mobile/DrawerSelect';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';

export default function StatementPage() {
  const { user } = useAuth();
  const [customer, setCustomer] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');

  useEffect(() => { loadData(); }, [user]);

  const loadData = async () => {
    setLoading(true);
    const mine = await getCustomerForUser(user);
    if (mine) {
      setCustomer(mine);
      const txs = await CashbackTransaction.filter({ customer_id: mine.id });
      setTransactions(txs.sort((a, b) => new Date(b.transaction_date) - new Date(a.transaction_date)));
    }
    setLoading(false);
  };

  const { pullDistance, refreshing, onTouchStart, onTouchMove, onTouchEnd } = usePullToRefresh(loadData);

  const filtered = transactions.filter(t =>
    (!filterStatus || t.status === filterStatus) &&
    (!filterType || t.type === filterType)
  );

  const handleExport = () => {
    exportToCSV(filtered, 'extrato.csv', [
      { key: 'sale_number', label: 'Venda' },
      { key: 'type', label: 'Tipo' },
      { key: 'status', label: 'Status' },
      { key: 'amount', label: 'Valor' },
      { key: 'transaction_date', label: 'Data' },
      { key: 'available_date', label: 'Disponível em' },
      { key: 'expiry_date', label: 'Expira em' },
    ]);
  };

  if (loading) return (
    <div className="flex items-center justify-center h-40">
      <div className="w-8 h-8 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
    </div>
  );

  return (
    <div
      className="p-4 md:p-8 max-w-2xl mx-auto"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {(pullDistance > 0 || refreshing) && (
        <div className="flex items-center justify-center overflow-hidden mb-2" style={{ height: refreshing ? 40 : pullDistance }}>
          <RefreshCw className={`w-6 h-6 text-orange-500 ${refreshing ? 'animate-spin' : ''}`} />
        </div>
      )}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Extrato Completo</h1>
          {customer && (
            <div className="flex gap-4 mt-2 text-sm">
              <span className="text-green-600 font-bold">Disponível: {formatCurrency(customer.available_balance)}</span>
              <span className="text-yellow-600 font-bold">Pendente: {formatCurrency(customer.pending_balance)}</span>
            </div>
          )}
        </div>
        <button onClick={handleExport} className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-50">
          <Download className="w-3.5 h-3.5" /> CSV
        </button>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        <DrawerSelect
          value={filterStatus}
          onChange={setFilterStatus}
          label="Filtrar por status"
          placeholder="Todos os status"
          options={[
            { value: '', label: 'Todos os status' },
            { value: 'pendente', label: 'Pendente' },
            { value: 'disponivel', label: 'Disponível' },
            { value: 'usado', label: 'Usado' },
            { value: 'expirado', label: 'Expirado' },
            { value: 'cancelado', label: 'Cancelado' },
          ]}
        />
        <DrawerSelect
          value={filterType}
          onChange={setFilterType}
          label="Filtrar por tipo"
          placeholder="Todos os tipos"
          options={[
            { value: '', label: 'Todos os tipos' },
            { value: 'gerado', label: 'Gerado' },
            { value: 'liberado', label: 'Liberado' },
            { value: 'utilizado', label: 'Utilizado' },
            { value: 'expirado', label: 'Expirado' },
            { value: 'cancelado', label: 'Cancelado' },
            { value: 'ajuste_manual', label: 'Ajuste Manual' },
          ]}
        />
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <FileText className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Nenhuma movimentação encontrada</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {filtered.map(tx => (
              <div key={tx.id} className="px-4 py-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-sm text-gray-900 capitalize">{tx.type?.replace('_', ' ')}</span>
                      <StatusBadge status={tx.status} />
                    </div>
                    <div className="text-xs text-gray-400 space-y-0.5">
                      <div>{formatDate(tx.transaction_date)}{tx.sale_number ? ` · Venda #${tx.sale_number}` : ''}</div>
                      {tx.available_date && <div>Disponível em: {formatDate(tx.available_date)}</div>}
                      {tx.expiry_date && <div>Expira em: {formatDate(tx.expiry_date)}</div>}
                      {tx.justification && <div className="text-purple-600">Justificativa: {tx.justification}</div>}
                    </div>
                  </div>
                  <span className={`font-black text-base ${tx.amount > 0 ? 'text-green-600' : 'text-red-500'}`}>
                    {tx.amount > 0 ? '+' : ''}{formatCurrency(tx.amount)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}