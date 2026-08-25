import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { formatDateTime, exportToCSV } from '@/lib/cashbackUtils';
import { Shield, Search, Download, Filter } from 'lucide-react';

export default function Audit() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterAction, setFilterAction] = useState('');

  useEffect(() => { loadLogs(); }, []);

  const loadLogs = async () => {
    setLoading(true);
    const data = await base44.entities.AuditLog.list('-created_date', 500);
    setLogs(data.filter(l => !l.is_demo));
    setLoading(false);
  };

  const filtered = logs.filter(l => {
    const matchSearch = !search || l.user_name?.toLowerCase().includes(search.toLowerCase()) || l.description?.toLowerCase().includes(search.toLowerCase()) || l.action?.toLowerCase().includes(search.toLowerCase());
    const matchAction = !filterAction || l.action === filterAction;
    return matchSearch && matchAction;
  });

  const uniqueActions = [...new Set(logs.map(l => l.action))].sort();

  const actionLabels = {
    register_sale: 'Registrar Venda',
    redeem_cashback: 'Usar Cashback',
    create_customer: 'Criar Cliente',
    update_customer: 'Atualizar Cliente',
    update_settings: 'Alterar Configurações',
    create_settings: 'Criar Configurações',
    create_category: 'Criar Categoria',
    update_category: 'Atualizar Categoria',
    manual_adjustment: 'Ajuste Manual',
    cancel_sale: 'Cancelar Venda',
  };

  const handleExport = () => {
    exportToCSV(filtered, 'auditoria.csv', [
      { key: 'user_name', label: 'Usuário' },
      { key: 'user_role', label: 'Perfil' },
      { key: 'action', label: 'Ação' },
      { key: 'entity_type', label: 'Entidade' },
      { key: 'description', label: 'Descrição' },
      { key: 'justification', label: 'Justificativa' },
      { key: 'created_date', label: 'Data/Hora' },
    ]);
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Auditoria</h1>
          <p className="text-gray-500 text-sm">{filtered.length} registros — todas as ações do sistema</p>
        </div>
        <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50">
          <Download className="w-4 h-4" /> Exportar CSV
        </button>
      </div>

      <div className="flex gap-3 mb-5 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por usuário ou descrição..."
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm bg-white" />
        </div>
        <select value={filterAction} onChange={e => setFilterAction(e.target.value)}
          className="px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm bg-white">
          <option value="">Todas as ações</option>
          {uniqueActions.map(a => <option key={a} value={a}>{actionLabels[a] || a}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40"><div className="w-8 h-8 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Shield className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-semibold">Nenhum registro encontrado</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left text-gray-500 font-semibold px-4 py-3">Data/Hora</th>
                  <th className="text-left text-gray-500 font-semibold px-4 py-3">Usuário</th>
                  <th className="text-left text-gray-500 font-semibold px-4 py-3">Ação</th>
                  <th className="text-left text-gray-500 font-semibold px-4 py-3">Descrição</th>
                  <th className="text-left text-gray-500 font-semibold px-4 py-3 hidden lg:table-cell">Justificativa</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(l => (
                  <tr key={l.id} className="border-t border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">{formatDateTime(l.created_date)}</td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-gray-900 text-xs">{l.user_name || '—'}</div>
                      <div className="text-gray-400 text-xs capitalize">{l.user_role || ''}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full font-mono">
                        {actionLabels[l.action] || l.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700 text-xs max-w-xs">{l.description}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs hidden lg:table-cell max-w-xs">
                      {l.justification || <span className="text-gray-300">—</span>}
                    </td>
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