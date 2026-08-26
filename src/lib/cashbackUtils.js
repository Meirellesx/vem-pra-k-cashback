import { base44 } from '@/api/base44Client';

export const getSettings = async () => {
  const settings = await base44.entities.CashbackSettings.list();
  if (settings && settings.length > 0) return settings[0];
  return {
    cashback_percentage: 5,
    min_purchase_to_use: 50,
    max_cashback_payment_percentage: 50,
    release_days: 0,
    balance_validity_days: 365,
    is_active: true,
  };
};

export const calculateCashback = (amount, percentage) => {
  return Math.round((amount * percentage / 100) * 100) / 100;
};

export const getAvailableDate = (releasedays) => {
  const date = new Date();
  date.setDate(date.getDate() + releasedays);
  return date.toISOString().split('T')[0];
};

export const getExpiryDate = (validityDays) => {
  const date = new Date();
  date.setDate(date.getDate() + validityDays);
  return date.toISOString().split('T')[0];
};

export const formatCurrency = (value) => {
  if (value === null || value === undefined || isNaN(value)) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

export const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('pt-BR');
};

export const formatDateTime = (dateStr) => {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleString('pt-BR');
};

export const formatPhone = (phone) => {
  if (!phone) return '';
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 11) {
    return `(${cleaned.slice(0,2)}) ${cleaned.slice(2,7)}-${cleaned.slice(7)}`;
  } else if (cleaned.length === 10) {
    return `(${cleaned.slice(0,2)}) ${cleaned.slice(2,6)}-${cleaned.slice(6)}`;
  }
  return phone;
};

// O código de identificação do cliente é o seu CPF (somente dígitos).
// Usado para verificação de identidade no resgate de cashback.
export const cpfToIdentifierCode = (cpf) => {
  if (!cpf) return '';
  return cpf.replace(/\D/g, '');
};

export const formatCpf = (cpf) => {
  if (!cpf) return '';
  const d = cpf.replace(/\D/g, '');
  if (d.length !== 11) return cpf;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
};

export const createAuditLog = async (user, action, entityType, entityId, description, justification, beforeData, afterData) => {
  try {
    await base44.entities.AuditLog.create({
      user_id: user?.id || 'system',
      user_name: user?.full_name || 'Sistema',
      user_role: user?.role || 'sistema',
      action,
      entity_type: entityType,
      entity_id: entityId || '',
      description,
      justification: justification || '',
      before_data: beforeData ? JSON.stringify(beforeData) : '',
      after_data: afterData ? JSON.stringify(afterData) : '',
    });
  } catch (e) {
    console.error('Audit log error:', e);
  }
};

export const exportToCSV = (data, filename, headers) => {
  const csvRows = [];
  csvRows.push(headers.map(h => h.label).join(';'));
  data.forEach(row => {
    csvRows.push(headers.map(h => {
      const val = row[h.key];
      if (val === null || val === undefined) return '';
      return String(val).replace(/;/g, ',').replace(/\n/g, ' ');
    }).join(';'));
  });
  const csvContent = '\uFEFF' + csvRows.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
};