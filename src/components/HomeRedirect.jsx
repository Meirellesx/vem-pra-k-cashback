import { Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';

export default function HomeRedirect() {
  const { user } = useAuth();
  const role = user?.role;
  const isCustomer = role === 'cliente' || role === 'user' || !role;
  return <Navigate to={isCustomer ? '/minha-area' : '/dashboard'} replace />;
}