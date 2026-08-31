import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { base44 } from '@/api/base44Client';
import { isMasterAccount } from '@/lib/internalAuth';
import { STAFF_ROLES } from '@/lib/constants';
import { Eye, EyeOff, LogIn, AlertCircle, User, Lock } from 'lucide-react';

export default function InternalLogin() {
  const { user, setInternalSession } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Só faz sentido na conta mestra. Qualquer outro usuário é redirecionado ao fluxo normal.
  if (!isMasterAccount(user)) {
    return <Navigate to="/" replace />;
  }

  const routeByRole = (role) => {
    if (role === 'cashier' || role === 'operador') return '/vendas';
    return '/dashboard';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('Informe usuário e senha.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await base44.functions.invoke('internal-login', {
        username: username.trim(),
        password,
      });
      const data = res?.data || res;
      if (!data?.success || !data?.operator) {
        throw new Error(data?.error || 'Não foi possível entrar.');
      }
      setInternalSession(data.operator);
      const dest = routeByRole(data.operator.role);
      navigate(dest, { replace: true });
    } catch (err) {
      setError(err.message || 'Falha no login.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center p-4 safe-top-bottom">
      <div className="w-full max-w-sm">
        {/* Logo / título */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl brand-gradient flex items-center justify-center mx-auto mb-4 shadow-lg shadow-orange-500/30">
            <span className="text-white font-black text-xl">K</span>
          </div>
          <h1 className="text-white font-black text-xl">Login do Funcionário</h1>
          <p className="text-gray-400 text-sm mt-1">Use seu usuário e senha do sistema</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl shadow-2xl p-6 space-y-4"
        >
          {/* Usuário */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
              Usuário (e-mail)
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="seu e-mail"
                autoCapitalize="none"
                autoCorrect="off"
                className="w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
          </div>

          {/* Senha */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
              Senha
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type={showPwd ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-10 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
              <button
                type="button"
                onClick={() => setShowPwd((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-60 shadow-lg shadow-orange-500/20"
          >
            <LogIn className="w-4 h-4" />
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <p className="text-center text-gray-500 text-xs mt-6 px-4">
          Esqueceu sua senha? Peça ao administrador para redefini-la no painel de Usuários.
        </p>
      </div>
    </div>
  );
}