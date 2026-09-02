import React, { useState } from 'react';
import { Plus, X, ShieldCheck } from 'lucide-react';
import { formatPhone } from '@/lib/cashbackUtils';

// Cartão de Modo Piloto WhatsApp: enquanto ativo, apenas os telefones
// autorizados são elegíveis para envio de mensagens pelo n8n/Avisa.
export default function PilotModeCard({ pilotoAtivo, telefones, onToggle, onAdd, onRemove }) {
  const [phone, setPhone] = useState('');

  const add = () => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 10 || (telefones || []).includes(digits)) { setPhone(''); return; }
    onAdd(digits);
    setPhone('');
  };

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-bold text-gray-900 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-orange-500" /> Modo Piloto WhatsApp
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">Restringe o envio de mensagens (n8n/Avisa) a uma lista controlada de telefones</p>
        </div>
        <button onClick={onToggle} aria-label="Alternar modo piloto"
          className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${pilotoAtivo ? 'bg-orange-500' : 'bg-gray-300'}`}>
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${pilotoAtivo ? 'translate-x-6' : 'translate-x-0'}`} />
        </button>
      </div>

      {pilotoAtivo ? (
        <div className="mt-4">
          <div className="flex gap-2">
            <input value={phone} onChange={e => setPhone(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()}
              type="tel" inputMode="tel" placeholder="(00) 00000-0000"
              className="flex-1 px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm" />
            <button onClick={add} disabled={phone.replace(/\D/g, '').length < 10}
              className="px-3 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white transition-colors">
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            {(telefones || []).map(t => (
              <span key={t} className="inline-flex items-center gap-2 bg-orange-50 border border-orange-200 text-orange-700 text-sm font-semibold pl-3 pr-2 py-1.5 rounded-xl">
                {formatPhone(t)}
                <button onClick={() => onRemove(t)} className="p-0.5 hover:bg-orange-100 rounded-lg" aria-label="Remover telefone">
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            ))}
            {(telefones || []).length === 0 && (
              <p className="text-xs text-gray-400">Nenhum telefone autorizado — enquanto o modo piloto estiver ativo sem números na lista, nenhuma mensagem será elegível para envio.</p>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-3">Enquanto ativo, apenas estes números recebem mensagens. Desative para liberar o envio para todos os clientes com aceite de comunicação.</p>
        </div>
      ) : (
        <p className="text-xs text-gray-400 mt-2">Inativo: todos os clientes com aceite de comunicação são elegíveis para envio.</p>
      )}
    </div>
  );
}