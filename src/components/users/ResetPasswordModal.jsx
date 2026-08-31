import React, { useState, useEffect } from 'react';
import { X, KeyRound, Eye, EyeOff } from 'lucide-react';

export default function ResetPasswordModal({ open, user, onSave, onCancel, saving }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setPassword('');
      setConfirm('');
      setShow(false);
      setError('');
    }
  }, [open]);

  if (!open) return null;

  const handleSubmit = () => {
    if (!password) return setError('Informe a nova senha.');
    if (password.length < 4) return setError('A senha deve ter ao menos 4 caracteres.');
    if (password !== confirm) return setError('As senhas não conferem.');
    onSave(password);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-orange-500" />
            Redefinir senha
          </h2>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-sm text-gray-500">
            Defina uma nova senha para <strong className="text-gray-900">{user?.full_name || user?.email}</strong>.
            Ela entra em vigor imediatamente — sem envio de e-mail.
          </p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nova senha</label>
            <div className="relative">
              <input
                type={show ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Nova senha"
                className="w-full px-3 py-2.5 pr-10 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar senha</label>
            <input
              type={show ? 'text' : 'password'}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Repita a nova senha"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        <div className="flex gap-3 justify-end p-5 border-t border-gray-200">
          <button
            onClick={onCancel}
            disabled={saving}
            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-xl font-medium text-sm transition-all disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-5 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-medium text-sm transition-all disabled:opacity-50"
          >
            {saving ? 'Salvando...' : 'Definir senha'}
          </button>
        </div>
      </div>
    </div>
  );
}