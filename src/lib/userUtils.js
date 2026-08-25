import { base44 } from '@/api/base44Client';
import { createAuditLog } from './cashbackUtils';
import { STAFF_ROLES } from './constants';

const STAFF_ROLE_KEYS = ['admin', 'manager', 'cashier', 'viewer', 'operador'];

export const isAdmin = (user) => user?.role === 'admin';

export const getUserStatus = (user) => user?.status || 'active';

export const getStaffUsers = async () => {
  const allUsers = await base44.entities.User.list('-created_date', 500);
  return (allUsers || []).filter(u => STAFF_ROLE_KEYS.includes(u.role));
};

export const countActiveAdmins = async () => {
  const allUsers = await base44.entities.User.list('-created_date', 500);
  return (allUsers || []).filter(u => u.role === 'admin' && getUserStatus(u) === 'active').length;
};

export const createEmployee = async (data, currentUser) => {
  const { full_name, email, phone, job_title, role, status, accepts_terms } = data;

  if (!full_name || !email || !role || !status) {
    throw new Error('Nome, e-mail, perfil de acesso e status são obrigatórios.');
  }

  // Check for existing user with same email
  const existing = await base44.entities.User.filter({ email });
  if (existing && existing.length > 0) {
    throw new Error('Já existe um usuário cadastrado com este e-mail.');
  }

  // Invite the user — sends email to set password securely
  try {
    await base44.users.inviteUser(email, role);
  } catch (inviteErr) {
    // Fallback: invite as 'user' and update role afterwards
    try {
      await base44.users.inviteUser(email, 'user');
    } catch (e2) {
      throw new Error('Não foi possível enviar o convite: ' + (e2.message || 'erro desconhecido'));
    }
  }

  // Find the newly created user and persist extra fields
  let newUser = null;
  try {
    const found = await base44.entities.User.filter({ email });
    newUser = found && found.length > 0 ? found[0] : null;
    if (newUser) {
      await base44.entities.User.update(newUser.id, {
        full_name: full_name,
        phone: phone || '',
        job_title: job_title || '',
        status: status,
        created_by: currentUser?.full_name || currentUser?.email || 'admin',
      });
    }
  } catch (e) {
    console.error('Could not update new user metadata:', e);
  }

  // Record terms acceptance
  if (accepts_terms && newUser) {
    try {
      await base44.entities.ConsentRecord.create({
        customer_id: newUser.id,
        customer_name: full_name,
        consent_type: 'termos_uso',
        accepted: true,
        consent_date: new Date().toISOString(),
        version: '1.0',
      });
    } catch (e) {
      console.error('Consent record error:', e);
    }
  }

  await createAuditLog(
    currentUser,
    'create_user',
    'User',
    newUser?.id || '',
    `Cadastro de funcionário: ${full_name} (${email}) — perfil: ${STAFF_ROLES[role] || role}, status: ${status}`,
    '',
    null,
    { full_name, email, role, job_title, status, accepts_terms }
  );

  return newUser;
};

export const updateEmployee = async (targetUser, data, currentUser, justification) => {
  const beforeData = {
    full_name: targetUser.full_name,
    phone: targetUser.phone,
    job_title: targetUser.job_title,
  };

  const updateData = {};
  if (data.full_name !== undefined) updateData.full_name = data.full_name;
  if (data.phone !== undefined) updateData.phone = data.phone || '';
  if (data.job_title !== undefined) updateData.job_title = data.job_title || '';

  const updated = await base44.entities.User.update(targetUser.id, updateData);

  await createAuditLog(
    currentUser,
    'update_user',
    'User',
    targetUser.id,
    `Atualização do funcionário ${targetUser.full_name || targetUser.email}`,
    justification,
    beforeData,
    updateData
  );

  return updated;
};

export const blockUser = async (targetUser, currentUser, justification) => {
  if (targetUser.id === currentUser.id) {
    throw new Error('Não é possível bloquear o próprio usuário.');
  }

  if (targetUser.role === 'admin' && getUserStatus(targetUser) === 'active') {
    const activeAdmins = await countActiveAdmins();
    if (activeAdmins <= 1) {
      throw new Error('Não é possível bloquear o último administrador ativo do sistema.');
    }
  }

  const beforeData = { status: getUserStatus(targetUser) };
  const now = new Date().toISOString();

  const updated = await base44.entities.User.update(targetUser.id, {
    status: 'blocked',
    blocked_at: now,
    blocked_by: currentUser.id,
  });

  await createAuditLog(
    currentUser,
    'block_user',
    'User',
    targetUser.id,
    `Bloqueio do funcionário ${targetUser.full_name || targetUser.email}`,
    justification,
    beforeData,
    { status: 'blocked', blocked_at: now, blocked_by: currentUser.id }
  );

  return updated;
};

export const reactivateUser = async (targetUser, currentUser, justification) => {
  const beforeData = { status: getUserStatus(targetUser) };

  const updated = await base44.entities.User.update(targetUser.id, {
    status: 'active',
    blocked_at: null,
    blocked_by: null,
  });

  await createAuditLog(
    currentUser,
    'reactivate_user',
    'User',
    targetUser.id,
    `Reativação do funcionário ${targetUser.full_name || targetUser.email}`,
    justification,
    beforeData,
    { status: 'active' }
  );

  return updated;
};

export const changeUserRole = async (targetUser, newRole, currentUser, justification) => {
  if (!justification || !justification.trim()) {
    throw new Error('Justificativa é obrigatória para alteração de perfil.');
  }

  if (targetUser.role === 'admin' && newRole !== 'admin') {
    const activeAdmins = await countActiveAdmins();
    if (activeAdmins <= 1) {
      throw new Error('Não é possível alterar o perfil do último administrador ativo.');
    }
  }

  const beforeData = { role: targetUser.role };
  const oldRoleLabel = STAFF_ROLES[targetUser.role] || targetUser.role;
  const newRoleLabel = STAFF_ROLES[newRole] || newRole;

  const updated = await base44.entities.User.update(targetUser.id, {
    role: newRole,
  });

  await createAuditLog(
    currentUser,
    'change_user_role',
    'User',
    targetUser.id,
    `Alteração de perfil de ${targetUser.full_name || targetUser.email}: ${oldRoleLabel} → ${newRoleLabel}`,
    justification,
    beforeData,
    { role: newRole }
  );

  return updated;
};

export const resetUserPassword = async (targetUser, currentUser) => {
  await base44.auth.resetPasswordRequest(targetUser.email);

  await createAuditLog(
    currentUser,
    'reset_user_password',
    'User',
    targetUser.id,
    `Redefinição de senha solicitada para ${targetUser.full_name || targetUser.email}`,
    '',
    null,
    { password_reset_requested: true }
  );
};