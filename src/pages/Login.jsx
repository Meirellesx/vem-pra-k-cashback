import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { safeReturnTo } from '@/lib/authReturnTo';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const returnTo = safeReturnTo();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await base44.auth.loginViaEmailPassword(email, password);
      window.location.href = returnTo;
    } catch (err) {
      const msg = (err?.message || '').toLowerCase();
      const status = err?.status;
      if (status === 403 || msg.includes('block') || msg.includes('desativ') || msg.includes('disabled')) {
        setError('Sua conta está bloqueada. Entre em contato com o administrador.');
      } else if (status === 404 || msg.includes('not found') || msg.includes('não encontr')) {
        setError('E-mail não encontrado. Verifique o endereço digitado.');
      } else if (status === 400 && (msg.includes('verif') || msg.includes('activ'))) {
        setError('Conta ainda não ativada. Use o link de definição de senha enviado por e-mail.');
      } else {
        setError('E-mail ou senha incorretos. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = () => {
    base44.auth.loginWithProvider('google', returnTo);
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo area */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-24 h-24 rounded-2xl bg-orange-500 flex items-center justify-center mb-4 shadow-2xl shadow-orange-500/40">
            <span className="text-white font-black text-4xl">K</span>
          </div>
          <h1 className="text-white font-black text-2xl">VEM PRA K</h1>
          <p className="text-orange-400 font-semibold text-sm mt-1">Sistema de Cashback</p>
        </div>

        <div className="bg-white rounded-2xl p-8 shadow-2xl">
          <h2 className="text-gray-900 font-bold text-xl mb-6">Entrar na sua conta</h2>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">E-mail</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="seu@email.com"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Senha</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm transition-all"
              />
            </div>
            <div className="text-right">
              <a href="/forgot-password" className="text-orange-500 text-sm font-medium hover:text-orange-600">
                Esqueci minha senha
              </a>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white font-bold rounded-xl transition-all shadow-lg shadow-orange-500/30 text-sm"
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200" /></div>
            <div className="relative flex justify-center"><span className="bg-white px-3 text-gray-400 text-xs">ou continue com</span></div>
          </div>

          <button
            onClick={handleGoogle}
            className="w-full py-3 border border-gray-200 rounded-xl flex items-center justify-center gap-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-all"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Entrar com Google
          </button>

          <div className="mt-5 p-4 bg-orange-50 border border-orange-200 rounded-xl">
            <p className="text-sm text-gray-700 leading-relaxed">
              <strong className="text-gray-900">Recebeu um convite ou é novo por aqui?</strong>
              <br />
              Crie sua conta e defina sua senha para ativar seu acesso.
            </p>
            <a
              href="/register"
              className="block w-full mt-3 py-2.5 text-center bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-sm transition-all"
            >
              Criar minha conta
            </a>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-center gap-4 text-xs">
          <Link to="/cashback-lookup" className="text-orange-400 hover:text-orange-300 font-medium">
            Consultar meu cashback
          </Link>
          <span className="text-gray-600">·</span>
          <Link to="/regras" className="text-gray-400 hover:text-gray-300 font-medium">
            Regras
          </Link>
          <span className="text-gray-600">·</span>
          <Link to="/privacidade" className="text-gray-400 hover:text-gray-300 font-medium">
            Privacidade
          </Link>
        </div>

        <p className="text-center text-gray-600 text-xs mt-6">
          © 2024 Vem Pra K — Sistema de Cashback
        </p>
      </div>
    </div>
  );
}