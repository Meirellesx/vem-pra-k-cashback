import React, { useState, useEffect } from 'react';
import { X, Mail, Phone, Briefcase, User, ShieldCheck, Save } from 'lucide-react';
import { STAFF_ROLES, USER_STATUS } from '@/lib/constants';
import DrawerSelect from '@/components/mobile/DrawerSelect';

export default function UserFormModal({ open, editingUser, onSave, onCancel, saving }) {
  const isEdit = !!editingUser;

  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    cpf: '',
    job_title: '',
    role: 'cashier',
    status: 'pending',
    accepts_terms: true,
  });

  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      if (editingUser) {
        setForm({
          full_name: editingUser.full_name || '',
          email: editingUser.email || '',
          phone: editingUser.phone || '',
          cpf: '',
          job_title: editingUser.job_title || '',
          role: editingUser.role || 'cashier',
          status: editingUser.status || 'active',
          accepts_terms: true,
        });
      } else {
        setForm({
          full_name: '',
          email: '',
          phone: '',
          cpf: '',
          job_title: '',
          role: 'cashier',
          status: 'pending',
          accepts_terms: true,
        });
      }
      setError('');
    }
  }, [open, editingUser]);

  if (!open) return null;

  const handleSubmit = () => {
    if (!form.full_name.trim()) return setError('Nome completo é obrigatório.');
    if (!form.email.trim()) return setError('E-mail é obrigatório.');
    if (!form.role) return setError('Perfil de acesso é obrigatório.');
    if (!form.status) return setError('Status inicial é obrigatório.');
    if (!isEdit && !form.accepts_terms) return setError('O aceite dos termos de uso internos é obrigatório.');

    onSave({
      ...form,
      full_name: form.full_name.trim(),
      email: form.email.trim().toLowerCase(),
      phone: form.phone.trim(),
      cpf: form.cpf ? form.cpf.trim() : '',
      job_title: form.job_title.trim(),
    });
  };

  const staffRoleOptions = ['admin', 'manager', 'cashier', 'viewer'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-200 sticky top-0 bg-white rounded-t-2xl">
          <h2 className="text-lg font-bold text-gray-900">
            {isEdit ? 'Editar Funcionário' : 'Novo Funcionário'}
          </h2>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Nome */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nome completo <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={form.full_name}
                onChange={e => setForm({ ...form, full_name: e.target.value })}
                placeholder="Nome do funcionário"
                className="w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
          </div>

          {/* E-mail */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              E-mail <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="email"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                placeholder="email@exemplo.com"
                disabled={isEdit}
                className="w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:bg-gray-100 disabled:text-gray-500"
              />
            </div>
            {isEdit && <p className="text-xs text-gray-400 mt-1">O e-mail não pode ser alterado.</p>}
          </div>

          {/* Telefone */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={form.phone}
                onChange={e => setForm({ ...form, phone: e.target.value })}
                placeholder="(00) 00000-0000"
                className="w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
          </div>

          {/* Cargo */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cargo / Função</label>
            <div className="relative">
              <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={form.job_title}
                onChange={e => setForm({ ...form, job_title: e.target.value })}
                placeholder="Ex: Operador de Caixa, Gerente..."
                className="w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
          </div>

          {/* Perfil de acesso */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Perfil de acesso <span className="text-red-500">*</span>
            </label>
            {isEdit ? (
              <div className="px-3 py-2.5 bg-gray-100 rounded-xl text-sm text-gray-600 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-gray-400" />
                {STAFF_ROLES[form.role] || form.role}
                <span className="text-xs text-gray-400 ml-auto">Use "Alterar Perfil" na lista para mudar</span>
              </div>
            ) : (
              <DrawerSelect
                value={form.role}
                onChange={(v) => setForm({ ...form, role: v })}
                label="Perfil de acesso"
                className="w-full px-3 py-2.5 text-sm min-w-0"
                options={staffRoleOptions.map(r => ({ value: r, label: STAFF_ROLES[r] }))}
              />
            )}
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status inicial <span className="text-red-500">*</span>
            </label>
            {isEdit ? (
              <div className="px-3 py-2.5 bg-gray-100 rounded-xl text-sm text-gray-600">
                {USER_STATUS[form.status]?.label || form.status}
                <span className="text-xs text-gray-400 ml-2">— use as ações na lista para alterar</span>
              </div>
            ) : (
              <DrawerSelect
                value={form.status}
                onChange={(v) => setForm({ ...form, status: v })}
                label="Status inicial"
                className="w-full px-3 py-2.5 text-sm min-w-0"
                options={[
                  { value: 'pending', label: 'Pendente (aguardando primeiro acesso)' },
                  { value: 'active', label: 'Ativo' },
                ]}
              />
            )}
          </div>

          {/* Terms (only on create) */}
          {!isEdit && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-3">
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.accepts_terms}
                  onChange={e => setForm({ ...form, accepts_terms: e.target.checked })}
                  className="mt-0.5 w-4 h-4 rounded accent-orange-500"
                />
                <span className="text-xs text-gray-700">
                  Declaro que o funcionário foi informado e aceita os <strong>termos de uso internos</strong> e
                  a política de acesso do sistema Vem Pra K Cashback. O usuário receberá um e-mail para
                  definir sua própria senha de acesso.
                </span>
              </label>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        <div className="flex gap-3 justify-end p-5 border-t border-gray-200 sticky bottom-0 bg-white rounded-b-2xl">
          <button onClick={onCancel} disabled={saving} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-xl font-medium text-sm transition-all disabled:opacity-50">
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-5 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-medium text-sm transition-all disabled:opacity-50 flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Salvando...' : isEdit ? 'Salvar alterações' : 'Cadastrar e enviar convite'}
          </button>
        </div>
      </div>
    </div>
  );
}