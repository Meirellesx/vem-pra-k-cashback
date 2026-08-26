import { Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';

export default function HomeRedirect() {
  const { user } = useAuth();
  const role = user?.role;

  // Clientes (ou sem perfil definido) vão à área do cliente.
  if (role === 'cliente' || role === 'user' || !role) {
    return <Navigate to="/minha-area" replace />;
  }
  // Operadores de caixa vão direto ao registro de vendas — não ao dashboard administrativo.
  if (role === 'cashier' || role === 'operador') {
    return <Navigate to="/vendas" replace />;
  }
  // Admin, gerente e consulta seguem para o dashboard.
  return <Navigate to="/dashboard" replace />;
}