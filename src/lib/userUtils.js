import { base44 } from '@/api/base44Client';
import { getOperator } from '@/lib/internalAuth';
import { STAFF_ROLES } from './constants';
import InternalAccount from '@/lib/internalAccountsDb';

const STAFF_ROLE_KEYS = ['admin', 'manager', 'cashier', 'viewer', 'operador'];

export const isAdmin = (user) => user?.role === 'admin';

export const getUserStatus = (account) => account?.status || 'active';

// Lista os funcionários a partir das contas do login interno (Supabase).
export const getStaffUsers = async () => {
  const accounts = await InternalAccount.list('-created_date', 500);
  return (accounts || [])
    .filter((a) => STAFF_ROLE_KEYS.includes(a.role))
    .map((a) => ({
      id: a.id,
      full_name: a.full_name,
      email: a.email,
      phone: a.phone || '',
      cpf: a.cpf || '',
      job_title: a.job_title || '',
      role: a.role,
      status: a.status || 'active',
      created_date: a.created_date,
      last_login_at: a.last_login_at,
      linked_customer_id: a.linked_customer_id || '',
      locked_until: a.locked_until || null,
    }));
};

const unwrap = (res) => res?.data ?? res;

export const createEmployee = async (data, currentUser) => {
  const operator = getOperator(currentUser);
  const res = await base44.functions.invoke('internal-account-manage', {
    action: 'create',
    full_name: data.full_name,
    email: data.email,
    phone: data.phone,
    cpf: data.cpf,
    job_title: data.job_title,
    role: data.role,
    password: data.password,
    actor_id: operator?.id,
    actor_name: operator?.full_name,
  });
  const d = unwrap(res);
  if (!d?.success) throw new Error(d?.error || 'Falha ao criar login interno.');
  return d;
};

export const updateEmployee = async (target, data, currentUser) => {
  const operator = getOperator(currentUser);
  const res = await base44.functions.invoke('internal-account-manage', {
    action: 'update',
    id: target.id,
    full_name: data.full_name,
    phone: data.phone,
    job_title: data.job_title,
    actor_id: operator?.id,
    actor_name: operator?.full_name,
  });
  const d = unwrap(res);
  if (!d?.success) throw new Error(d?.error || 'Falha ao atualizar.');
  return d;
};

export const blockUser = async (target, currentUser, justification) => {
  const isSelf =
    target.id === currentUser.id ||
    (target.email && currentUser.email && target.email.toLowerCase() === currentUser.email.toLowerCase());
  if (isSelf) {
    throw new Error('Não é possível bloquear a si mesmo.');
  }
  if (target.role === 'admin') {
    const activeAdmins = await countActiveAdmins();
    if (activeAdmins <= 1) {
      throw new Error('Não é possível bloquear o último administrador ativo do sistema.');
    }
  }
  const operator = getOperator(currentUser);
  const res = await base44.functions.invoke('internal-account-manage', {
    action: 'block',
    id: target.id,
    justification,
    actor_id: operator?.id,
    actor_name: operator?.full_name,
  });
  const d = unwrap(res);
  if (!d?.success) throw new Error(d?.error || 'Falha ao bloquear.');
  return d;
};

export const reactivateUser = async (target, currentUser) => {
  const operator = getOperator(currentUser);
  const res = await base44.functions.invoke('internal-account-manage', {
    action: 'reactivate',
    id: target.id,
    actor_id: operator?.id,
    actor_name: operator?.full_name,
  });
  const d = unwrap(res);
  if (!d?.success) throw new Error(d?.error || 'Falha ao reativar.');
  return d;
};

export const changeUserRole = async (target, newRole, currentUser, justification) => {
  if (!justification || !justification.trim()) {
    throw new Error('Justificativa é obrigatória para alteração de perfil.');
  }
  const operator = getOperator(currentUser);
  const res = await base44.functions.invoke('internal-account-manage', {
    action: 'changeRole',
    id: target.id,
    role: newRole,
    justification,
    actor_id: operator?.id,
    actor_name: operator?.full_name,
  });
  const d = unwrap(res);
  if (!d?.success) throw new Error(d?.error || 'Falha ao alterar perfil.');
  return d;
};

// Redefinição direta de senha — sem e-mail, sem OTP.
export const resetUserPassword = async (target, newPassword, currentUser) => {
  const operator = getOperator(currentUser);
  const res = await base44.functions.invoke('internal-account-manage', {
    action: 'resetPassword',
    id: target.id,
    newPassword,
    actor_id: operator?.id,
    actor_name: operator?.full_name,
  });
  const d = unwrap(res);
  if (!d?.success) throw new Error(d?.error || 'Falha ao redefinir senha.');
  return d;
};

export const countActiveAdmins = async () => {
  const accounts = await InternalAccount.filter({ role: 'admin', status: 'active' });
  return (accounts || []).length;
};

// Garante que o administrador logado tenha um registro em internal_accounts
// (idempotente). Faz o admin aparecer na lista de funcionários e ser contado.
export const syncSelfAccount = async () => {
  const res = await base44.functions.invoke('internal-account-manage', { action: 'syncSelf' });
  return unwrap(res);
};