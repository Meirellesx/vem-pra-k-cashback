import React from 'react';
import { Link } from 'react-router-dom';

export default function PageNotFound() {
  return (
    <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center p-4">
      <div className="text-center text-white">
        <div className="text-8xl font-black text-orange-500 mb-4">404</div>
        <h1 className="text-2xl font-bold mb-2">Página não encontrada</h1>
        <p className="text-gray-400 mb-6">A página que você busca não existe.</p>
        <Link to="/" className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl transition-all">
          Voltar ao início
        </Link>
      </div>
    </div>
  );
}