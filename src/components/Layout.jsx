import React, { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { base44 } from '@/api/base44Client';
import {
  LayoutDashboard, Users, ShoppingCart, Settings, FileText, Shield,
  BarChart3, LogOut, Menu, X, ChevronRight, Wallet, UserCircle,
  Bell, Package
} from 'lucide-react';

const LogoMark = () => (
  <div className="flex items-center gap-2">
    <img
      src="https://media.base44.com/files/public/user_68df03321ddb88e340d96028/9df156de3_Logo.pdf"
      alt="Vem Pra K"
      className="h-10 w-10 object-contain"
      onError={(e) => {
        e.target.style.display = 'none';
      }}
    />
    <div>
      <div className="text-white font-black text-sm leading-tight">VEM PRA K</div>
      <div className="text-orange-400 font-semibold text-xs leading-tight">CASHBACK</div>
    </div>
  </div>
);

const navByRole = {
  admin: [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/clientes', label: 'Clientes', icon: Users },
    { path: '/vendas', label: 'Registrar Venda', icon: ShoppingCart },
    { path: '/cashback', label: 'Consultar Cashback', icon: Wallet },
    { path: '/relatorios', label: 'Relatórios', icon: BarChart3 },
    { path: '/auditoria', label: 'Auditoria', icon: Shield },
    { path: '/configuracoes', label: 'Configurações', icon: Settings },
    { path: '/categorias', label: 'Categorias', icon: Package },
  ],
  operador: [
    { path: '/vendas', label: 'Registrar Venda', icon: ShoppingCart },
    { path: '/cashback', label: 'Consultar Cashback', icon: Wallet },
    { path: '/clientes', label: 'Clientes', icon: Users },
  ],
  cliente: [
    { path: '/minha-area', label: 'Minha Área', icon: UserCircle },
    { path: '/extrato', label: 'Extrato', icon: FileText },
    { path: '/regras', label: 'Regras do Programa', icon: Shield },
  ],
};

export default function Layout() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const role = user?.role || 'cliente';
  const navItems = navByRole[role] || navByRole.cliente;

  const handleLogout = () => {
    base44.auth.logout('/login');
  };

  const NavLink = ({ item }) => {
    const Icon = item.icon;
    const isActive = location.pathname === item.path;
    return (
      <Link
        to={item.path}
        onClick={() => setSidebarOpen(false)}
        className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
          isActive
            ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/30'
            : 'text-gray-300 hover:bg-white/10 hover:text-white'
        }`}
      >
        <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-white' : 'text-gray-400 group-hover:text-orange-400'}`} />
        <span className="font-medium text-sm">{item.label}</span>
        {isActive && <ChevronRight className="w-4 h-4 ml-auto" />}
      </Link>
    );
  };

  const Sidebar = ({ mobile }) => (
    <div className={`flex flex-col h-full ${mobile ? '' : ''}`}>
      <div className="p-5 border-b border-white/10">
        <LogoMark />
      </div>

      <div className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navItems.map(item => <NavLink key={item.path} item={item} />)}
      </div>

      <div className="p-4 border-t border-white/10">
        <div className="flex items-center gap-3 mb-3 px-2">
          <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-white font-bold text-sm">
            {user?.full_name?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-white text-sm font-semibold truncate">{user?.full_name || 'Usuário'}</div>
            <div className="text-gray-400 text-xs capitalize">{role}</div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2 px-4 py-2 rounded-xl text-gray-400 hover:bg-red-500/20 hover:text-red-400 transition-all text-sm"
        >
          <LogOut className="w-4 h-4" />
          Sair
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Desktop sidebar */}
      <div className="hidden md:flex md:w-64 flex-shrink-0 bg-[#0A0A0A] flex-col">
        <Sidebar />
      </div>

      {/* Mobile sidebar */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <div className="relative w-72 bg-[#0A0A0A] flex flex-col shadow-2xl">
            <button
              onClick={() => setSidebarOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white p-1"
            >
              <X className="w-5 h-5" />
            </button>
            <Sidebar mobile />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile header */}
        <div className="md:hidden bg-[#0A0A0A] px-4 py-3 flex items-center justify-between">
          <LogoMark />
          <button onClick={() => setSidebarOpen(true)} className="text-white p-1">
            <Menu className="w-6 h-6" />
          </button>
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}