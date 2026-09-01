import React, { useState, Suspense, useRef, useEffect } from 'react';
import { Outlet, Link, useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { base44 } from '@/api/base44Client';
import { isMasterAccount } from '@/lib/internalAuth';
import {
  LayoutDashboard, Users, ShoppingCart, Settings, FileText, Shield,
  BarChart3, LogOut, Menu, X, ChevronRight, Wallet, UserCircle,
  Bell, Package, UserCog, QrCode, MessageCircle
} from 'lucide-react';
import MobileNav from '@/components/mobile/MobileNav';
import MobileHeader from '@/components/mobile/MobileHeader';
import PageTransition from '@/components/mobile/PageTransition';

const ContentLoader = () => (
  <div className="flex items-center justify-center h-64">
    <div className="w-8 h-8 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
  </div>
);

const LogoMark = () => (
  <div className="flex items-center gap-2">
    <img
      src="https://media.base44.com/files/public/user_68df03321ddb88e340d96028/9df156de3_Logo.pdf"
      alt="Vem Pra K"
      className="h-10 w-10 object-contain"
      onError={(e) => { e.target.style.display = 'none'; }}
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
    { path: '/usuarios', label: 'Usuários e Funcionários', icon: UserCog },
    { path: '/relatorios', label: 'Relatórios', icon: BarChart3 },
    { path: '/auditoria', label: 'Auditoria', icon: Shield },
    { path: '/configuracoes', label: 'Configurações', icon: Settings },
    { path: '/categorias', label: 'Categorias', icon: Package },
    { path: '/bot-whatsapp', label: 'Bot WhatsApp', icon: MessageCircle },
  ],
  manager: [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/clientes', label: 'Clientes', icon: Users },
    { path: '/vendas', label: 'Registrar Venda', icon: ShoppingCart },
    { path: '/cashback', label: 'Consultar Cashback', icon: Wallet },
    { path: '/relatorios', label: 'Relatórios', icon: BarChart3 },
    { path: '/auditoria', label: 'Auditoria', icon: Shield },
    { path: '/bot-whatsapp', label: 'Bot WhatsApp', icon: MessageCircle },
  ],
  cashier: [
    { path: '/vendas', label: 'Registrar Venda', icon: ShoppingCart },
    { path: '/cashback', label: 'Consultar Cashback', icon: Wallet },
    { path: '/clientes', label: 'Clientes', icon: Users },
  ],
  viewer: [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/clientes', label: 'Clientes', icon: Users },
    { path: '/vendas', label: 'Vendas', icon: ShoppingCart },
    { path: '/cashback', label: 'Consultar Cashback', icon: Wallet },
    { path: '/relatorios', label: 'Relatórios', icon: BarChart3 },
  ],
  operador: [
    { path: '/vendas', label: 'Registrar Venda', icon: ShoppingCart },
    { path: '/cashback', label: 'Consultar Cashback', icon: Wallet },
    { path: '/clientes', label: 'Clientes', icon: Users },
  ],
  cliente: [
    { path: '/minha-area', label: 'Minha Área', icon: UserCircle },
    { path: '/meu-codigo', label: 'Meu Código', icon: QrCode },
    { path: '/extrato', label: 'Extrato', icon: FileText },
    { path: '/regras', label: 'Regras do Programa', icon: Shield },
  ],
  user: [
    { path: '/minha-area', label: 'Minha Área', icon: UserCircle },
    { path: '/meu-codigo', label: 'Meu Código', icon: QrCode },
    { path: '/extrato', label: 'Extrato', icon: FileText },
    { path: '/regras', label: 'Regras do Programa', icon: Shield },
  ],
};

export default function Layout() {
  const { user, internalUser, clearInternalSession } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isMobile = useIsMobile();

  const isMaster = isMasterAccount(user);

  // Perfil efetivo: na conta mestra, vem do login interno; nos demais, do Base44.
  const role = isMaster ? internalUser?.role : user?.role || 'cliente';
  const navItems = navByRole[role] || navByRole.cliente;
  const isCustomer = role === 'cliente' || role === 'user';

  // Identidade exibida na barra lateral.
  const displayName = isMaster ? internalUser?.full_name : user?.full_name || 'Usuário';

  // Layout-level scroll cache: preserve scroll depth across customer MobileNav tab switches.
  const mainRef = useRef(null);
  const scrollCache = useRef({});

  useEffect(() => {
    const main = mainRef.current;
    if (!main || !isCustomer) return;
    const onSave = () => { scrollCache.current[location.pathname] = main.scrollTop; };
    main.addEventListener('scroll', onSave, { passive: true });
    return () => main.removeEventListener('scroll', onSave);
  }, [location.pathname, isCustomer]);

  useEffect(() => {
    const main = mainRef.current;
    if (!main || !isCustomer) return;
    const saved = scrollCache.current[location.pathname] || 0;
    let attempts = 0;
    const tryRestore = () => {
      attempts++;
      if (main.scrollHeight - main.clientHeight >= saved - 2) {
        main.scrollTop = saved;
      }
      if (attempts < 10 && Math.abs(main.scrollTop - saved) > 2) {
        requestAnimationFrame(tryRestore);
      }
    };
    const id = requestAnimationFrame(tryRestore);
    return () => cancelAnimationFrame(id);
  }, [location.pathname, isCustomer]);

  // Re-seleção de aba ativa no bottom nav: rola o container principal ao topo
  // de forma suave e descarta o cache de scroll da rota atual (reseta o estado
  // de visualização aninhada/rota). Repassa o callback ao MobileNav.
  const handleTabReselect = () => {
    const main = mainRef.current;
    if (main) main.scrollTo({ top: 0, behavior: 'smooth' });
    if (location.pathname) scrollCache.current[location.pathname] = 0;
  };

  // Conta mestra sem login interno ativo → não tem acesso às telas internas.
  // (Guarda após os hooks para respeitar as rules-of-hooks.)
  if (isMaster && !internalUser) {
    return <Navigate to="/login-interno" replace />;
  }

  const handleLogout = () => {
    if (isMaster) {
      // A conta mestra do Base44 permanece logada no aparelho; só encerra a sessão do funcionário.
      clearInternalSession();
      window.location.href = '/login-interno';
      return;
    }
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

  const Sidebar = () => (
    <div className="flex flex-col h-full">
      <div className="p-5 border-b border-white/10">
        <LogoMark />
      </div>
      <div className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navItems.map(item => <NavLink key={item.path} item={item} />)}
      </div>
      <div className="p-4 border-t border-white/10">
        <div className="flex items-center gap-3 mb-3 px-2">
          <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-white font-bold text-sm">
            {displayName?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-white text-sm font-semibold truncate">{displayName}</div>
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

      {/* Mobile staff drawer (non-customer roles) */}
      {!isCustomer && sidebarOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <div className="relative w-72 bg-[#0A0A0A] flex flex-col shadow-2xl">
            <button
              onClick={() => setSidebarOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white p-1 z-10"
            >
              <X className="w-5 h-5" />
            </button>
            <Sidebar />
          </div>
        </div>
      )}

      {/* Main content column */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile top bar */}
        {isCustomer ? (
          <MobileHeader />
        ) : (
          <div
            className="md:hidden bg-[#0A0A0A] px-4 py-3 flex items-center justify-between"
            style={{ paddingTop: 'max(env(safe-area-inset-top), 0.75rem)' }}
          >
            <LogoMark />
            <button onClick={() => setSidebarOpen(true)} className="text-white p-1">
              <Menu className="w-6 h-6" />
            </button>
          </div>
        )}

        <main
          ref={mainRef}
          className="flex-1 overflow-y-auto"
          style={isCustomer && isMobile ? { paddingBottom: 'calc(4rem + env(safe-area-inset-bottom))' } : undefined}
        >
          <Suspense fallback={<ContentLoader />}>
            <PageTransition>
              <Outlet />
            </PageTransition>
          </Suspense>
        </main>
      </div>

      {/* Mobile bottom navigation (customer roles only) */}
      {isCustomer && <MobileNav onReselect={handleTabReselect} />}
    </div>
  );
}