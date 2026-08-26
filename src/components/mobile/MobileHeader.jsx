import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

const TITLES = {
  '/minha-area': 'Minha Área',
  '/extrato': 'Extrato',
  '/regras': 'Regras do Programa',
  '/meu-codigo': 'Meu Código',
  '/privacidade': 'Privacidade',
};

export default function MobileHeader() {
  const location = useLocation();
  const navigate = useNavigate();
  const title = TITLES[location.pathname] || 'Vem Pra K Cashback';
  const isHome = location.pathname === '/minha-area';
  const canGoBack = typeof window !== 'undefined' && window.history.state?.idx > 0;
  const handleBack = () => (canGoBack ? navigate(-1) : navigate('/minha-area'));

  return (
    <header
      className="sticky top-0 z-30 bg-[#0A0A0A] border-b border-white/5 md:hidden"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div className="flex items-center h-14 px-1">
        {isHome ? (
          <div className="w-11" />
        ) : (
          <button
            onClick={handleBack}
            className="p-2.5 text-white active:bg-white/10 rounded-lg"
            aria-label="Voltar"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}
        <h1 className="flex-1 text-center text-white font-bold text-base truncate px-2">{title}</h1>
        <div className="w-11" />
      </div>
    </header>
  );
}