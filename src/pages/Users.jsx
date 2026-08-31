import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import UserStats from '@/components/users/UserStats';
import UserFormModal from '@/components/users/UserFormModal';
import ConfirmDialog from '@/components/users/ConfirmDialog';
import ResetPasswordModal from '@/components/users/ResetPasswordModal';
import {
  getStaffUsers,
  getUserStatus,
  createEmployee,
  updateEmployee,
  blockUser,
  reactivateUser,
  changeUserRole,
  resetUserPassword,
} from '@/lib/userUtils';
import { getOperator } from '@/lib/internalAuth';
import { STAFF_ROLES, USER_STATUS } from '@/lib/constants';
import { formatDateTime, formatDate } from '@/lib/cashbackUtils';
import AuditLog from '@/lib/auditLogDb';
import {
  UserCog, Search, Plus, Edit, Ban, CheckCircle, KeyRound, Lock, ChevronDown,
} from 'lucide-react';

export default function Users() {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();

  const operator = getOperator(currentUser);

  const [users, setUsers] = useState([]);
  const [recentLogs, setRecentLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [saving, setSaving] = useState(false);

  const [confirm, setConfirm] = useState(null);

  const [resetTarget, setResetTarget] = useState(null);
  const [resetSaving, setResetSaving] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [staff, logs] = await Promise.all([
        getStaffUsers(),
        AuditLog.filter({ entity_type: 'InternalAccount' }, '-created_date', 15).catch(() => []),
      ]);
      setUsers(staff);
      setRecentLogs(logs || []);
    } catch (e) {
      toast({ title: 'Erro', description: 'Falha ao carregar funcionários.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const filtered = useMemo(() => {
    return users.filter(u => {
      const name = (u.full_name || u.email || '').toLowerCase();
      const email = (u.email || '').toLowerCase();
      const q = search.toLowerCase();
      const matchesSearch = !search || name.includes(q) || email.includes(q);
      const matchesRole = roleFilter === 'all' || u.role === roleFilter;
      const matchesStatus = statusFilter === 'all' || getUserStatus(u) === statusFilter;
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, search, roleFilter, statusFilter]);

  // --- Handlers ---

  const handleCreate = async (data) => {
    setSaving(true);
    try {
      await createEmployee(data, currentUser);
      toast({ title: 'Funcionário cadastrado', description: `Login interno criado para ${data.full_name}. Entregue a senha definida.` });
      setShowForm(false);
      await loadData();
    } catch (e) {
      toast({ title: 'Erro ao cadastrar', description: e.message || 'Falha no cadastro.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async (data) => {
    setSaving(true);
    try {
      await updateEmployee(editingUser, data, currentUser);
      toast({ title: 'Funcionário atualizado', description: 'Dados salvos com sucesso.' });
      setShowForm(false);
      setEditingUser(null);
      await loadData();
    } catch (e) {
      toast({ title: 'Erro ao atualizar', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleConfirm = async (justification) => {
    if (!confirm) return;
    setConfirm({ ...confirm, loading: true });
    try {
      const { type, user } = confirm;
      if (type === 'block') {
        await blockUser(user, currentUser, justification);
        toast({ title: 'Usuário bloqueado', description: `${user.full_name || user.email} foi bloqueado.` });
      } else if (type === 'unblock') {
        await reactivateUser(user, currentUser, justification);
        toast({ title: 'Usuário reativado', description: `${user.full_name || user.email} foi reativado.` });
      } else if (type === 'role') {
        await changeUserRole(user, confirm.role, currentUser, justification);
        toast({ title: 'Perfil alterado', description: `Novo perfil: ${STAFF_ROLES[confirm.role]}. O funcionário precisará entrar novamente.` });
      }
      setConfirm(null);
      await loadData();
    } catch (e) {
      toast({ title: 'Erro', description: e.message || 'Operação falhou.', variant: 'destructive' });
      setConfirm({ ...confirm, loading: false });
    }
  };

  const handleResetPassword = async (newPassword) => {
    setResetSaving(true);
    try {
      await resetUserPassword(resetTarget, newPassword, currentUser);
      toast({ title: 'Senha redefinida', description: `Nova senha definida para ${resetTarget.full_name || resetTarget.email}.` });
      setResetTarget(null);
      await loadData();
    } catch (e) {
      toast({ title: 'Erro', description: e.message || 'Falha ao redefinir senha.', variant: 'destructive' });
    } finally {
      setResetSaving(false);
    }
  };

  const openBlock = (user) => setConfirm({ type: 'block', user, destructive: true });
  const openUnblock = (user) => setConfirm({ type: 'unblock', user });
  const openRoleChange = (user, newRole) => setConfirm({ type: 'role', user, role: newRole });
  const openReset = (user) => setResetTarget(user);

  // --- Access control ---
  if (currentUser?.role !== 'admin') {
    return (
      <div className="p-6 flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Acesso restrito</h2>
          <p className="text-gray-500 text-sm">
            Apenas administradores podem acessar a área de Usuários e Funcionários.
          </p>
        </div>
      </div>
    );
  }

  const statusBadge = (status) => {
    const cfg = USER_STATUS[status] || USER_STATUS.active;
    return (
      <span className={`inline-flex items-center rounded-full font-medium text-xs px-2 py-0.5 ${cfg.color}`}>
        {cfg.label}
      </span>
    );
  };

  const confirmConfig = () => {
    if (!confirm) return {};
    const u = confirm.user;
    const name = u.full_name || u.email;
    switch (confirm.type) {
      case 'block':
        return {
          title: 'Bloquear funcionário',
          message: `Tem certeza que deseja bloquear ${name}? O funcionário não poderá acessar o sistema até ser reativado. Vendas e movimentações anteriores serão preservadas.`,
          confirmLabel: 'Bloquear',
          destructive: true,
          requireJustification: true,
        };
      case 'unblock':
        return {
          title: 'Reativar funcionário',
          message: `Tem certeza que deseja reativar ${name}? O funcionário voltará a ter acesso ao sistema.`,
          confirmLabel: 'Reativar',
          destructive: false,
          requireJustification: false,
        };
      case 'role':
        return {
          title: 'Alterar perfil de acesso',
          message: `Tem certeza que deseja alterar o perfil de ${name} para "${STAFF_ROLES[confirm.role]}"? O funcionário precisará entrar novamente.`,
          confirmLabel: 'Confirmar alteração',
          destructive: false,
          requireJustification: true,
        };
      default:
        return {};
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
            <UserCog className="w-6 h-6 text-orange-500" />
            Usuários e Funcionários
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Crie logins internos e gerencie perfis de acesso — sem depender de e-mail.
          </p>
        </div>
        <button
          onClick={() => { setEditingUser(null); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-orange-500/20"
        >
          <Plus className="w-4 h-4" />
          Novo funcionário
        </button>
      </div>

      {/* Dashboard */}
      {!loading && <UserStats users={users} recentLogs={recentLogs} />}

      {/* Filters + search */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nome ou e-mail..."
              className="w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
          <select
            value={roleFilter}
            onChange={e => setRoleFilter(e.target.value)}
            className="px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
          >
            <option value="all">Todos os perfis</option>
            <option value="admin">Administrador</option>
            <option value="manager">Gerente</option>
            <option value="cashier">Operador de Caixa</option>
            <option value="viewer">Consulta</option>
            <option value="operador">Operador (legado)</option>
          </select>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
          >
            <option value="all">Todos os status</option>
            <option value="active">Ativo</option>
            <option value="blocked">Bloqueado</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <UserCog className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-sm">Nenhum funcionário encontrado com os filtros atuais.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                  <th className="text-left px-4 py-3 font-semibold">Nome / E-mail</th>
                  <th className="text-left px-4 py-3 font-semibold whitespace-nowrap">Telefone</th>
                  <th className="text-left px-4 py-3 font-semibold whitespace-nowrap">Cargo</th>
                  <th className="text-left px-4 py-3 font-semibold">Perfil</th>
                  <th className="text-left px-4 py-3 font-semibold">Status</th>
                  <th className="text-left px-4 py-3 font-semibold whitespace-nowrap">Criado em</th>
                  <th className="text-left px-4 py-3 font-semibold whitespace-nowrap">Último acesso</th>
                  <th className="text-right px-4 py-3 font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(u => {
                  const status = getUserStatus(u);
                  const isBlocked = status === 'blocked';
                  const isSelf = u.id === operator?.id;
                  return (
                    <tr
                      key={u.id}
                      className={`hover:bg-gray-50 transition-colors ${isBlocked ? 'bg-red-50/40' : ''}`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0 ${
                            isBlocked ? 'bg-gray-300 text-gray-600' : 'bg-orange-500 text-white'
                          }`}>
                            {(u.full_name || u.email || '?').charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-gray-900 truncate flex items-center gap-1.5">
                              {u.full_name || u.email}
                              {isSelf && <span className="text-xs text-orange-500 font-medium">(você)</span>}
                              {isBlocked && <Lock className="w-3 h-3 text-red-500 flex-shrink-0" />}
                            </div>
                            <div className="text-xs text-gray-400 truncate">{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{u.phone || '—'}</td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{u.job_title || '—'}</td>
                      <td className="px-4 py-3">
                        <RoleMenu
                          user={u}
                          operatorId={operator?.id}
                          onRoleChange={(newRole) => openRoleChange(u, newRole)}
                        />
                      </td>
                      <td className="px-4 py-3">{statusBadge(status)}</td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatDate(u.created_date)}</td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                        {u.last_login_at ? formatDateTime(u.last_login_at) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => { setEditingUser(u); setShowForm(true); }}
                            title="Editar"
                            className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-all"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openReset(u)}
                            title="Redefinir senha"
                            className="p-1.5 rounded-lg text-gray-500 hover:bg-blue-100 hover:text-blue-600 transition-all"
                          >
                            <KeyRound className="w-4 h-4" />
                          </button>
                          {isBlocked ? (
                            <button
                              onClick={() => openUnblock(u)}
                              title="Reativar"
                              className="p-1.5 rounded-lg text-green-600 hover:bg-green-100 transition-all"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </button>
                          ) : (
                            <button
                              onClick={() => openBlock(u)}
                              disabled={isSelf}
                              title={isSelf ? 'Não é possível bloquear a si mesmo' : 'Bloquear'}
                              className="p-1.5 rounded-lg text-red-500 hover:bg-red-100 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              <Ban className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Form modal */}
      <UserFormModal
        open={showForm}
        editingUser={editingUser}
        saving={saving}
        onSave={editingUser ? handleEdit : handleCreate}
        onCancel={() => { setShowForm(false); setEditingUser(null); }}
      />

      {/* Reset password modal */}
      <ResetPasswordModal
        open={!!resetTarget}
        user={resetTarget}
        saving={resetSaving}
        onSave={handleResetPassword}
        onCancel={() => setResetTarget(null)}
      />

      {/* Confirm dialog */}
      <ConfirmDialog
        open={!!confirm}
        title={confirmConfig().title}
        message={confirmConfig().message}
        confirmLabel={confirmConfig().confirmLabel}
        destructive={confirmConfig().destructive}
        requireJustification={confirmConfig().requireJustification}
        loading={confirm?.loading}
        onConfirm={handleConfirm}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}

// Inline role dropdown component
function RoleMenu({ user, operatorId, onRoleChange }) {
  const [open, setOpen] = useState(false);
  const isSelf = user.id === operatorId;
  const roleOptions = ['admin', 'manager', 'cashier', 'viewer'];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-xs font-medium text-gray-700 transition-all"
      >
        {STAFF_ROLES[user.role] || user.role}
        <ChevronDown className="w-3 h-3" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-1 z-20 bg-white border border-gray-200 rounded-xl shadow-lg py-1 min-w-[180px]">
            <div className="px-3 py-1.5 text-xs text-gray-400 font-medium border-b border-gray-100 mb-1">
              Alterar perfil
            </div>
            {roleOptions.map(r => (
              <button
                key={r}
                onClick={() => {
                  setOpen(false);
                  if (r !== user.role) onRoleChange(r);
                }}
                disabled={r === user.role}
                className={`w-full text-left px-3 py-1.5 text-xs hover:bg-orange-50 transition-colors flex items-center justify-between ${
                  r === user.role ? 'text-gray-400 cursor-default' : 'text-gray-700'
                }`}
              >
                <span>{STAFF_ROLES[r]}</span>
                {r === user.role && <CheckCircle className="w-3 h-3 text-orange-500" />}
              </button>
            ))}
            {isSelf && (
              <div className="px-3 py-1.5 text-xs text-gray-400 italic border-t border-gray-100 mt-1">
                Não é possível alterar o próprio perfil aqui
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}