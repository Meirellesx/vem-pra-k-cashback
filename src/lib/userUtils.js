import { base44 } from '@/api/base44Client';
import { createAuditLog } from './cashbackUtils';
import { STAFF_ROLES } from './constants';

const STAFF_ROLE_KEYS = ['admin', 'manager', 'cashier', 'viewer', 'operador', 'user', 'cliente'];

export const isAdmin = (user) => user?.role === 'admin';

export const getUserStatus = (user) => user?.status || 'active';

export const getStaffUsers = async () => {
  const [allUsers, invitations] = await Promise.all([
    base44.entities.User.list('-created_date', 500),
    base44.entities.StaffInvitation.list('-invited_at', 500).catch(() => []),
  ]);
  const users = (allUsers || []).filter(u => STAFF_ROLE_KEYS.includes(u.role));
  const userEmails = new Set(users.map(u => (u.email || '').toLowerCase()));

  // Pending invitations for users who haven't accepted yet — shown as pseudo-users
  const pending = (invitations || [])
    .filter(inv => inv.status === 'pending' && !userEmails.has((inv.email || '').toLowerCase()))
    .map(inv => ({
      id: inv.id,
      full_name: inv.full_name,
      email: inv.email,
      phone: inv.phone || '',
      job_title: inv.job_title || '',
      role: inv.role,
      status: 'pending',
      created_date: inv.invited_at || inv.created_date,
      last_login_at: null,
      _isPending: true,
      _invitationId: inv.id,
    }));

  return [...users, ...pending];
};

export const resendInvitation = async (invitation, currentUser) => {
  // Garante que a conta do usuário exista. O invite-staff usa register(), que
  // materializa o registro de User imediatamente (o inviteUser original não
  // criava o registro, e por isso o reset nunca encontrava o usuário).
  try {
    await base44.functions.invoke('invite-staff', {
      email: invitation.email,
      full_name: invitation.full_name,
      phone: invitation.phone,
      job_title: invitation.job_title,
      role: invitation.role,
    });
  } catch (e) {
    console.error('invite-staff on resend (continuing):', e.message);
  }

  // Dispara o link de definição de senha (token único/temporário -> /reset-password).
  await base44.auth.resetPasswordRequest(invitation.email);

  await base44.entities.StaffInvitation.update(invitation._invitationId || invitation.id, {
    invited_at: new Date().toISOString(),
    invited_by: currentUser?.full_name || currentUser?.email || 'admin',
  });

  await createAuditLog(
    currentUser,
    'resend_invitation',
    'StaffInvitation',
    invitation._invitationId || invitation.id,
    `Reenvio de convite para ${invitation.full_name || invitation.email}`,
    '',
    null,
    { email: invitation.email }
  );
};

export const cancelInvitation = async (invitation, currentUser) => {
  await base44.entities.StaffInvitation.update(invitation._invitationId || invitation.id, {
    status: 'cancelled',
  });

  await createAuditLog(
    currentUser,
    'cancel_invitation',
    'StaffInvitation',
    invitation._invitationId || invitation.id,
    `Cancelamento do convite de ${invitation.full_name || invitation.email}`,
    '',
    null,
    { email: invitation.email }
  );
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

  // Check for an existing pending invitation with the same email (re-add scenario)
  const existingInv = await base44.entities.StaffInvitation.filter({ email, status: 'pending' }).catch(() => []);

  // Chama a função de backend que cria a conta, define o perfil e dispara o
  // link de definição de senha (mesmo fluxo que funciona para clientes).
  let newUser = null;
  try {
    const res = await base44.functions.invoke('invite-staff', {
      email,
      full_name,
      phone,
      job_title,
      role,
    });
    if (res?.userId) {
      newUser = { id: res.userId, email };
    }
  } catch (e) {
    console.error('invite-staff failed (continuing anyway):', e.message);
  }

  // Track the invitation locally so the employee appears in the list
  // even before accepting the invite and setting a password.
  let invitation = null;
  try {
    if (existingInv && existingInv.length > 0) {
      invitation = await base44.entities.StaffInvitation.update(existingInv[0].id, {
        full_name: full_name,
        phone: phone || '',
        job_title: job_title || '',
        role: role,
        status: 'pending',
        invited_by: currentUser?.full_name || currentUser?.email || 'admin',
        invited_at: new Date().toISOString(),
      });
    } else {
      invitation = await base44.entities.StaffInvitation.create({
        full_name: full_name,
        email: email,
        phone: phone || '',
        job_title: job_title || '',
        role: role,
        status: 'pending',
        invited_by: currentUser?.full_name || currentUser?.email || 'admin',
        invited_at: new Date().toISOString(),
      });
    }
  } catch (e) {
    console.error('Could not create staff invitation record:', e);
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