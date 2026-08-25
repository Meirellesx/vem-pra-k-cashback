import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';

export default function Register() {
  const [step, setStep] = useState('form');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const returnTo = new URLSearchParams(window.location.search).get('returnTo') || '/';

  const handleRegister = async (e) => {
    e.preventDefault();
    if (password !== confirm) { setError('As senhas não coincidem.'); return; }
    setError(''); setLoading(true);
    try {
      await base44.auth.register({ email, password });
      setStep('otp');
    } catch (err) {
      setError(err?.message || 'Erro ao criar conta.');
    } finally { setLoading(false); }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const { access_token } = await base44.auth.verifyOtp({ email, otpCode: otp });
      base44.auth.setToken(access_token);
      window.location.href = returnTo;
    } catch (err) {
      setError('Código inválido. Tente novamente.');
    } finally { setLoading(false); }
  };

  const handleResend = async () => {
    try { await base44.auth.resendOtp(email); } catch {}
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="w-20 h-20 rounded-2xl bg-orange-500 flex items-center justify-center mb-3 shadow-2xl shadow-orange-500/40">
            <span className="text-white font-black text-3xl">K</span>
          </div>
          <h1 className="text-white font-black text-2xl">VEM PRA K</h1>
          <p className="text-orange-400 font-semibold text-sm">Sistema de Cashback</p>
        </div>

        <div className="bg-white rounded-2xl p-8 shadow-2xl">
          {step === 'form' ? (
            <>
              <h2 className="font-bold text-xl mb-6">Criar conta</h2>
              {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>}
              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">E-mail</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Senha</label>
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Confirmar senha</label>
                  <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm" />
                </div>
                <button type="submit" disabled={loading}
                  className="w-full py-3 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white font-bold rounded-xl transition-all shadow-lg shadow-orange-500/30 text-sm">
                  {loading ? 'Criando...' : 'Criar conta'}
                </button>
              </form>
              <p className="text-center text-sm text-gray-500 mt-5">
                Já tem conta? <a href="/login" className="text-orange-500 font-semibold">Entrar</a>
              </p>
            </>
          ) : (
            <>
              <h2 className="font-bold text-xl mb-2">Verificar e-mail</h2>
              <p className="text-gray-500 text-sm mb-6">Enviamos um código para <strong>{email}</strong></p>
              {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>}
              <form onSubmit={handleVerify} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Código de verificação</label>
                  <input type="text" value={otp} onChange={e => setOtp(e.target.value)} required maxLength={6}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 text-center text-2xl tracking-widest font-mono" />
                </div>
                <button type="submit" disabled={loading}
                  className="w-full py-3 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white font-bold rounded-xl transition-all text-sm">
                  {loading ? 'Verificando...' : 'Verificar'}
                </button>
              </form>
              <button onClick={handleResend} className="w-full text-center text-orange-500 text-sm mt-3 hover:underline">
                Reenviar código
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}