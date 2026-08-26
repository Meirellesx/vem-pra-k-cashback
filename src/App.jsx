import React, { Suspense, lazy } from 'react';
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import ProtectedRoute from '@/components/ProtectedRoute';
import Layout from '@/components/Layout';
import HomeRedirect from '@/components/HomeRedirect';

// Auth pages (lazy-loaded for faster initial webview load)
const Login = lazy(() => import('@/pages/Login'));
const Register = lazy(() => import('@/pages/Register'));
const ForgotPassword = lazy(() => import('@/pages/ForgotPassword'));
const ResetPassword = lazy(() => import('@/pages/ResetPassword'));

// App pages (lazy-loaded)
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const Customers = lazy(() => import('@/pages/Customers'));
const Sales = lazy(() => import('@/pages/Sales'));
const CashbackLookup = lazy(() => import('@/pages/CashbackLookup'));
const Reports = lazy(() => import('@/pages/Reports'));
const Audit = lazy(() => import('@/pages/Audit'));
const Settings = lazy(() => import('@/pages/Settings'));
const Categories = lazy(() => import('@/pages/Categories'));
const Users = lazy(() => import('@/pages/Users'));
const CustomerArea = lazy(() => import('@/pages/CustomerArea'));
const StatementPage = lazy(() => import('@/pages/StatementPage'));
const ProgramRules = lazy(() => import('@/pages/ProgramRules'));
const Privacy = lazy(() => import('@/pages/Privacy'));
const MeuCodigo = lazy(() => import('@/pages/MeuCodigo'));

const FullScreenLoader = () => (
  <div className="fixed inset-0 flex items-center justify-center bg-[#0A0A0A]">
    <div className="w-8 h-8 border-4 border-orange-900 border-t-orange-500 rounded-full animate-spin"></div>
  </div>
);

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin, logout } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[#0A0A0A]">
        <div className="w-8 h-8 border-4 border-orange-900 border-t-orange-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    } else if (authError.type === 'user_blocked') {
      return (
        <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center p-4">
          <div className="max-w-md text-center">
            <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">🔒</span>
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Acesso bloqueado</h1>
            <p className="text-gray-400 mb-6">{authError.message || 'Seu acesso foi bloqueado pelo administrador.'}</p>
            <button onClick={() => logout()} className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl transition-all">
              Ir para o login
            </button>
          </div>
        </div>
      );
    }
  }

  return (
    <Suspense fallback={<FullScreenLoader />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
          <Route element={<Layout />}>
            {/* Admin & Operator routes */}
            <Route path="/" element={<HomeRedirect />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/clientes" element={<Customers />} />
            <Route path="/vendas" element={<Sales />} />
            <Route path="/cashback" element={<CashbackLookup />} />
            <Route path="/relatorios" element={<Reports />} />
            <Route path="/auditoria" element={<Audit />} />
            <Route path="/configuracoes" element={<Settings />} />
            <Route path="/categorias" element={<Categories />} />
            <Route path="/usuarios" element={<Users />} />
            {/* Customer routes */}
            <Route path="/minha-area" element={<CustomerArea />} />
            <Route path="/extrato" element={<StatementPage />} />
            <Route path="/regras" element={<ProgramRules />} />
            <Route path="/privacidade" element={<Privacy />} />
            <Route path="/meu-codigo" element={<MeuCodigo />} />
          </Route>
        </Route>

        <Route path="*" element={<PageNotFound />} />
      </Routes>
    </Suspense>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App