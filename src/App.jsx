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
import CustomerArea from '@/pages/CustomerArea';
import StatementPage from '@/pages/StatementPage';
import ProgramRules from '@/pages/ProgramRules';
import Privacy from '@/pages/Privacy';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

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