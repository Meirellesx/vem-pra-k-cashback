import React, { useState, useEffect } from 'react';
import { X, Mail, Phone, Briefcase, User, ShieldCheck, Save, KeyRound } from 'lucide-react';
import { STAFF_ROLES } from '@/lib/constants';

export default function UserFormModal({ open, editingUser, onSave, onCancel, saving }) {
  const isEdit = !!editingUser;

  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    cpf: '',
    job_title: '',
    role: 'cashier',
    password: '',
    confirm: '',
  });

  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      if (editingUser) {
        setForm({
          full_name: editingUser.full_name || '',
          email: editingUser.email || '',
          phone: editingUser.phone || '',
          cpf: editingUser.cpf || '',
          job_title: editingUser.job_title || '',
          role: editingUser.role || 'cashier',
          password: '',
          confirm: '',
        });
      } else {
        setForm({
          full_name: '',
          email: '',
          phone: '',
          cpf: '',
          job_title: '',
          role: 'cashier',
          password: '',
          confirm: '',
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
    if (!isEdit) {
      if (!form.password) return setError('Defina uma senha inicial para o funcionário.');
      if (form.password.length < 4) return setError('A senha deve ter ao menos 4 caracteres.');
      if (form.password !== form.confirm) return setError('As senhas não conferem.');
    }

    onSave({
      ...form,
      full_name: form.full_name.trim(),
      email: form.email.trim().toLowerCase(),
      phone: form.phone.trim(),
      cpf: form.cpf ? form.cpf.trim() : '',
      job_title: form.job_title.trim(),
      password: form.password,
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
          {!isEdit && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 text-xs text-gray-700">
              O login interno dispensa e-mail de ativação. Você define a senha agora e entrega ao
              funcionário, que entra direto com usuário e senha no aparelho da loja.
            </div>
          )}

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

          {/* E-mail / Usuário */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              E-mail (usuário de login) <span className="text-red-500">*</span>
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
            {isEdit && <p className="text-xs text-gray-400 mt-1">O e-mail/usuário não pode ser alterado.</p>}
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

          {/* CPF */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">CPF</label>
            <div className="relative">
              <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={form.cpf}
                onChange={e => setForm({ ...form, cpf: e.target.value })}
                placeholder="000.000.000-00"
                className="w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">Usado para o funcionário acumular/resgatar cashback nas próprias compras.</p>
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
            <div className="grid grid-cols-2 gap-2">
              {staffRoleOptions.map((r) => {
                const active = form.role === r;
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setForm({ ...form, role: r })}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                      active
                        ? 'border-orange-500 bg-orange-50 text-orange-700 ring-2 ring-orange-500/30'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${active ? 'border-orange-500' : 'border-gray-300'}`}>
                      {active && <span className="w-2 h-2 rounded-full bg-orange-500" />}
                    </span>
                    {STAFF_ROLES[r]}
                  </button>
                );
              })}
            </div>
            {isEdit && (
              <p className="text-xs text-gray-400 mt-1">A alteração de perfil é registrada no log de auditoria.</p>
            )}
          </div>

          {/* Senha inicial (somente no cadastro) */}
          {!isEdit && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Senha inicial <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={form.password}
                    onChange={e => setForm({ ...form, password: e.target.value })}
                    placeholder="Senha"
                    className="w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Confirmar senha <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={form.confirm}
                    onChange={e => setForm({ ...form, confirm: e.target.value })}
                    placeholder="Repita a senha"
                    className="w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>
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
            {saving ? 'Salvando...' : isEdit ? 'Salvar alterações' : 'Cadastrar funcionário'}
          </button>
        </div>
      </div>
    </div>
  );
}