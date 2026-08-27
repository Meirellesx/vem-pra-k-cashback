import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const token = new URLSearchParams(window.location.search).get('token') || '';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirm) { setError('As senhas não coincidem.'); return; }
    setError(''); setLoading(true);
    try {
      await base44.auth.resetPassword({ resetToken: token, newPassword: password });
      setDone(true);
      setTimeout(() => { window.location.href = '/login'; }, 2000);
    } catch (err) {
      const msg = (err?.message || '').toLowerCase();
      const status = err?.status;
      if (msg.includes('expir') || status === 410) {
        setError('O link expirou. Solicite um novo link de ativação no painel administrativo.');
      } else if (msg.includes('utiliz') || msg.includes('used') || status === 409) {
        setError('Este link já foi utilizado. Solicite um novo link de ativação.');
      } else if (msg.includes('inválid') || msg.includes('invalid') || status === 404 || status === 400) {
        setError('Link inválido. Verifique se você abriu o link mais recente enviado por e-mail.');
      } else {
        setError('Não foi possível redefinir a senha. O link pode estar inválido ou expirado.');
      }
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="w-20 h-20 rounded-2xl bg-orange-500 flex items-center justify-center mb-3 shadow-2xl shadow-orange-500/40">
            <span className="text-white font-black text-3xl">K</span>
          </div>
          <h1 className="text-white font-black text-2xl">VEM PRA K</h1>
        </div>
        <div className="bg-white rounded-2xl p-8 shadow-2xl">
          {done ? (
            <div className="text-center py-4">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-green-600 text-2xl">✓</span>
              </div>
              <p className="text-gray-700 font-semibold">Senha redefinida com sucesso!</p>
              <p className="text-gray-500 text-sm mt-1">Redirecionando...</p>
            </div>
          ) : (
            <>
              <h2 className="font-bold text-xl mb-6">Nova senha</h2>
              {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Nova senha</label>
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Confirmar senha</label>
                  <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm" />
                </div>
                <button type="submit" disabled={loading}
                  className="w-full py-3 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white font-bold rounded-xl text-sm">
                  {loading ? 'Salvando...' : 'Redefinir senha'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}