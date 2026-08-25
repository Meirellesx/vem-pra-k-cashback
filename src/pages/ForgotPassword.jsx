import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try { await base44.auth.resetPasswordRequest(email); } catch {}
    finally { setLoading(false); setSent(true); }
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
          <h2 className="font-bold text-xl mb-2">Redefinir senha</h2>
          {sent ? (
            <div className="text-center py-4">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-green-600 text-2xl">✓</span>
              </div>
              <p className="text-gray-600 text-sm">Se existe uma conta com este e-mail, você receberá as instruções em breve.</p>
              <a href="/login" className="block mt-4 text-orange-500 font-semibold text-sm hover:underline">Voltar ao login</a>
            </div>
          ) : (
            <>
              <p className="text-gray-500 text-sm mb-6">Informe seu e-mail para receber o link de redefinição.</p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="seu@email.com"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm" />
                <button type="submit" disabled={loading}
                  className="w-full py-3 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white font-bold rounded-xl text-sm">
                  {loading ? 'Enviando...' : 'Enviar link'}
                </button>
              </form>
              <a href="/login" className="block text-center text-gray-500 text-sm mt-4 hover:underline">Voltar ao login</a>
            </>
          )}
        </div>
      </div>
    </div>
  );
}