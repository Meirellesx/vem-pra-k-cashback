import { MASTER_STAFF_EMAIL } from '@/lib/constants';

const SESSION_KEY = 'vpk_internal_session';

// A conta Base44 "mestra", logada nos aparelhos compartilhados da loja.
// Quem opera o sistema na conta mestra é identificado pelo login interno.
export function isMasterAccount(user) {
  return !!user && (user.email || '').toLowerCase() === MASTER_STAFF_EMAIL;
}

export function getInternalSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || !data.id || !data.role) return null;
    return data;
  } catch (e) {
    return null;
  }
}

export function setInternalSession(operator) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(operator));
}

export function clearInternalSession() {
  localStorage.removeItem(SESSION_KEY);
}

// Modo interno = conta mestra logada + sessão interna ativa.
export function isInternalMode(base44User) {
  return isMasterAccount(base44User) && !!getInternalSession();
}

// Retorna a identidade de operação efetiva:
// - na conta mestra com sessão interna → operador interno (login interno)
// - caso contrário → próprio usuário Base44 (admin real ou cliente)
export function getOperator(base44User) {
  if (isMasterAccount(base44User)) {
    const internal = getInternalSession();
    if (internal) return internal;
  }
  return base44User;
}