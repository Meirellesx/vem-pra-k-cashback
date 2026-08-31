import React from 'react';
import { QrCode, Copy, Check } from 'lucide-react';
import { formatCpf } from '@/lib/cashbackUtils';

export default function MyCodeCard({ customer }) {
  const code = customer?.identifier_code || '';
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    if (!code) return;
    navigator.clipboard?.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  if (!code) {
    return (
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 text-center">
        <QrCode className="w-10 h-10 text-gray-300 mx-auto mb-2" />
        <p className="text-sm text-gray-500">Seu código de identificação ainda não foi gerado. Procure o caixa para concluir o cadastro.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 text-center">
      <h3 className="font-bold text-gray-900 mb-1">Meu Código de Identificação</h3>
      <p className="text-xs text-gray-500 mb-4">Apresente este código no caixa para identificar seu cashback.</p>

      <div className="w-40 h-40 bg-[#0A0A0A] mx-auto rounded-2xl flex flex-col items-center justify-center mb-4 p-4">
        <div className="grid grid-cols-3 gap-1 w-full mb-2">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className={`h-4 rounded-sm ${[0, 2, 6, 8, 4].includes(i) ? 'bg-orange-500' : 'bg-[#ffffff]'}`} />
          ))}
        </div>
        <div className="text-white font-mono text-[10px] font-bold mt-1 tracking-widest">{formatCpf(code)}</div>
      </div>

      <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 mb-3">
        <span className="font-mono font-black text-orange-600 text-xl tracking-widest">{formatCpf(code)}</span>
      </div>

      <button
        onClick={handleCopy}
        className="inline-flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-orange-600"
      >
        {copied ? <><Check className="w-4 h-4 text-green-600" /> Copiado!</> : <><Copy className="w-4 h-4" /> Copiar código</>}
      </button>
    </div>
  );
}