import React from 'react';
import { Outlet, Link } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import Layout from '@/components/Layout';

const FullScreenLoader = () => (
  <div className="fixed inset-0 flex items-center justify-center bg-gray-50">
    <div className="w-8 h-8 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
  </div>
);

const LogoMark = () => (
  <div className="flex items-center gap-2">
    <div className="w-9 h-9 rounded-xl bg-orange-500 flex items-center justify-center text-white font-black">K</div>
    <div>
      <div className="text-white font-black text-sm leading-tight">VEM PRA K</div>
      <div className="text-orange-400 font-semibold text-[10px] leading-tight">CASHBACK</div>
    </div>
  </div>
);

// Rota pública: usuários autenticados continuam dentro do Layout normal (sidebar);
// visitantes veem apenas um cabeçalho mínimo com o botão "Entrar".
export default function PublicShell() {
  const { isAuthenticated, isLoadingAuth } = useAuth();

  if (isLoadingAuth) return <FullScreenLoader />;
  if (isAuthenticated) return <Layout />;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-[#0A0A0A] sticky top-0 z-20" style={{ paddingTop: 'max(env(safe-area-inset-top), 0.75rem)', paddingBottom: '0.75rem' }}>
        <div className="max-w-2xl mx-auto px-4 flex items-center justify-between">
          <LogoMark />
          <Link to="/login" className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-sm transition-all">
            Entrar
          </Link>
        </div>
      </header>
      <main className="max-w-2xl mx-auto px-4">
        <Outlet />
      </main>
    </div>
  );
}