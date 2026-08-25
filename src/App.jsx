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

// Auth pages
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';

// App pages
import Dashboard from '@/pages/Dashboard';
import Customers from '@/pages/Customers';
import Sales from '@/pages/Sales';
import CashbackLookup from '@/pages/CashbackLookup';
import Reports from '@/pages/Reports';
import Audit from '@/pages/Audit';
import Settings from '@/pages/Settings';
import Categories from '@/pages/Categories';
import Users from '@/pages/Users';
import CustomerArea from '@/pages/CustomerArea';
import StatementPage from '@/pages/StatementPage';
import ProgramRules from '@/pages/ProgramRules';
import Privacy from '@/pages/Privacy';

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
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
        <Route element={<Layout />}>
          {/* Admin & Operator routes */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
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
        </Route>
      </Route>

      <Route path="*" element={<PageNotFound />} />
    </Routes>
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