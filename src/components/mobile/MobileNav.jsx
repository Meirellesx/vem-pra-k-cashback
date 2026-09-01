import { Link, useLocation } from 'react-router-dom';
import { UserCircle, FileText, Shield, QrCode } from 'lucide-react';

const tabs = [
  { path: '/minha-area', label: 'Minha Área', icon: UserCircle },
  { path: '/extrato', label: 'Extrato', icon: FileText },
  { path: '/regras', label: 'Regras', icon: Shield },
  { path: '/meu-codigo', label: 'Meu Código', icon: QrCode },
];

export default function MobileNav({ onReselect }) {
  const location = useLocation();
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 bg-[#0A0A0A] border-t border-white/10 md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = location.pathname === tab.path;
          return (
            <Link
              key={tab.path}
              to={tab.path}
              onClick={(e) => {
                // Tapping the already-active tab: suppress navigation and ask
                // the layout to scroll to top + reset nested view/route cache.
                if (active && onReselect) {
                  e.preventDefault();
                  onReselect();
                }
              }}
              className={`flex-1 flex flex-col items-center gap-1 py-2.5 transition-colors ${
                active ? 'text-orange-500' : 'text-gray-400'
              }`}
            >
              <Icon className="w-5 h-5" strokeWidth={active ? 2.5 : 2} />
              <span className="text-[10px] font-semibold">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}