import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { base44 } from '@/api/base44Client';

export default function HomeRedirect() {
  const { user } = useAuth();
  const role = user?.role;

  // Usuários recém-cadastrados (perfil padrão "user") podem ter um convite de
  // funcionário pendente. Verificamos antes de redirecionar: se houver, aplicamos
  // o perfil e recarregamos para o redirecionamento considerar o perfil correto.
  const needsStaffCheck = role === 'user' || role === undefined || role === null;
  const [checking, setChecking] = useState(needsStaffCheck);

  useEffect(() => {
    if (!needsStaffCheck || !user?.email || !user?.id) {
      setChecking(false);
      return;
    }
    let active = true;
    base44.functions
      .invoke('assign-staff-role', { user_id: user.id, email: user.email })
      .then((res) => {
        if (active && res?.assigned) {
          window.location.reload();
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setChecking(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, user?.email, user?.id]);

  if (checking) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[#0A0A0A]">
        <div className="w-8 h-8 border-4 border-orange-900 border-t-orange-500 rounded-full animate-spin" />
      </div>
    );
  }

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