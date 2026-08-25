import React from 'react';
import { UserCog, CheckCircle, Ban, Users as UsersIcon, Clock, Activity } from 'lucide-react';
import { STAFF_ROLES, USER_STATUS } from '@/lib/constants';
import { getUserStatus } from '@/lib/userUtils';
import { formatDateTime, formatDate } from '@/lib/cashbackUtils';

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <div className="text-2xl font-black text-gray-900 leading-none">{value}</div>
        <div className="text-xs text-gray-500 mt-1">{label}</div>
      </div>
    </div>
  );
}

export default function UserStats({ users, recentLogs }) {
  const total = users.length;
  const active = users.filter(u => getUserStatus(u) === 'active').length;
  const blocked = users.filter(u => getUserStatus(u) === 'blocked').length;
  const pending = users.filter(u => getUserStatus(u) === 'pending').length;

  const roleGroups = [
    { key: 'admin', label: 'Administrador' },
    { key: 'manager', label: 'Gerente' },
    { key: 'cashier', label: 'Operador de Caixa' },
    { key: 'viewer', label: 'Consulta' },
    { key: 'cliente', label: 'Cliente', roles: ['cliente', 'user'] },
  ];

  const byRole = roleGroups.reduce((acc, g) => {
    acc[g.key] = { label: g.label, count: users.filter(u => (g.roles || [g.key]).includes(u.role)).length };
    return acc;
  }, {});

  const recentUsers = [...users]
    .sort((a, b) => new Date(b.created_date || 0) - new Date(a.created_date || 0))
    .slice(0, 5);

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={UsersIcon} label="Total de usuários" value={total} color="bg-orange-100 text-orange-600" />
        <StatCard icon={CheckCircle} label="Ativos" value={active} color="bg-green-100 text-green-600" />
        <StatCard icon={Ban} label="Bloqueados" value={blocked} color="bg-red-100 text-red-600" />
        <StatCard icon={Clock} label="Pendentes" value={pending} color="bg-yellow-100 text-yellow-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Users by role */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
            <UserCog className="w-4 h-4 text-orange-500" />
            Usuários por perfil
          </h3>
          <div className="space-y-2">
            {Object.entries(byRole).map(([key, { label, count }]) => {
              const pct = total > 0 ? (count / total) * 100 : 0;
              return (
                <div key={key} className="flex items-center gap-3">
                  <div className="w-28 text-xs text-gray-600 font-medium flex-shrink-0">{label}</div>
                  <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-orange-500 rounded-full transition-all"
                      style={{ width: `${Math.max(pct, count > 0 ? 8 : 0)}%` }}
                    />
                  </div>
                  <div className="w-8 text-right text-xs font-bold text-gray-700">{count}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent activity */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
            <Activity className="w-4 h-4 text-orange-500" />
            Últimas alterações
          </h3>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {(recentLogs || []).length === 0 && (
              <p className="text-xs text-gray-400 italic">Nenhuma alteração registrada.</p>
            )}
            {(recentLogs || []).slice(0, 6).map((log, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <div className="w-1.5 h-1.5 rounded-full bg-orange-400 mt-1.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-gray-700 truncate">{log.description}</div>
                  <div className="text-gray-400">
                    {log.user_name || 'Sistema'} · {formatDateTime(log.created_date)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent users */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="text-sm font-bold text-gray-700 mb-3">Últimos usuários criados</h3>
        <div className="space-y-2">
          {recentUsers.length === 0 && <p className="text-xs text-gray-400 italic">Nenhum usuário cadastrado.</p>}
          {recentUsers.map(u => (
            <div key={u.id} className="flex items-center gap-3 text-sm">
              <div className="w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center font-bold text-xs flex-shrink-0">
                {(u.full_name || u.email || '?').charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-800 truncate">{u.full_name || u.email}</div>
                <div className="text-xs text-gray-400">{STAFF_ROLES[u.role] || u.role}</div>
              </div>
              <div className="text-xs text-gray-400 flex-shrink-0">{formatDate(u.created_date)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}