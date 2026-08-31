import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { formatCurrency } from '@/lib/cashbackUtils';
import { Search, Wallet, Clock, Shield, FileText, AlertCircle, Loader2 } from 'lucide-react';

export default function PublicCashbackLookup() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const handleSearch = async (e) => {
    e.preventDefault();
    const q = query.trim();
    if (q.length < 3) {
      setError('Digite seu CPF, telefone ou código de identificação.');
      return;
    }
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await base44.functions.invoke('public-cashback-lookup', { op: 'lookup', query: q });
      const data = res?.data ?? res;
      if (data?.error) throw new Error(data.error);
      setResult(data);
      if (!data?.found) setError('Nenhum cliente encontrado com esses dados. Verifique e tente novamente.');
    } catch (e) {
      setError('Não foi possível consultar agora. Tente novamente em instantes.');
    } finally {
      setLoading(false);
    }
  };

  const s = result?.settings;

  return (
    <div className="py-6">
      <div className="text-center mb-6">
        <div className="w-14 h-14 bg-orange-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
          <Wallet className="w-7 h-7 text-orange-600" />
        </div>
        <h1 className="text-2xl font-black text-gray-900">Consultar meu Cashback</h1>
        <p className="text-gray-500 text-sm mt-1">Veja seu saldo sem precisar entrar na conta.</p>
      </div>

      <form onSubmit={handleSearch} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-4">
        <label className="block text-sm font-semibold text-gray-700 mb-1.5">CPF, telefone ou código</label>
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ex: 000.000.000-00 ou (00) 00000-0000"
            className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20"
        >
          {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Consultando...</> : 'Consultar saldo'}
        </button>
      </form>

      {error && (
        <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-xl text-orange-700 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {result?.found && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="text-xs text-gray-500 mb-1">Cliente encontrado</div>
            <div className="font-bold text-gray-900 mb-4">{result.name_masked}</div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                <div className="flex items-center gap-1.5 mb-1">
                  <Wallet className="w-4 h-4 text-green-600" />
                  <span className="text-[11px] font-semibold text-green-700 uppercase tracking-wide">Disponível</span>
                </div>
                <div className="text-xl font-black text-green-600">{formatCurrency(result.available_balance)}</div>
              </div>
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                <div className="flex items-center gap-1.5 mb-1">
                  <Clock className="w-4 h-4 text-yellow-600" />
                  <span className="text-[11px] font-semibold text-yellow-700 uppercase tracking-wide">Pendente</span>
                </div>
                <div className="text-xl font-black text-yellow-600">{formatCurrency(result.pending_balance)}</div>
              </div>
            </div>
          </div>

          {s && (
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <h3 className="font-bold text-gray-900 mb-3 text-sm">Regras do programa</h3>
              <ul className="space-y-1.5 text-sm text-gray-600">
                <li>• <strong>{s.cashback_percentage}%</strong> de cashback nas compras</li>
                <li>• Compra mínima para usar: <strong>{formatCurrency(s.min_purchase_to_use)}</strong></li>
                <li>• Pague até <strong>{s.max_cashback_payment_percentage}%</strong> da compra com cashback</li>
                <li>• Saldo válido por <strong>{s.balance_validity_days} dias</strong></li>
                {s.release_days > 0 && <li>• Cashback libera em <strong>{s.release_days} dias</strong></li>}
              </ul>
            </div>
          )}

          <div className="flex gap-3">
            <Link to="/regras" className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 text-center hover:bg-gray-50 flex items-center justify-center gap-2">
              <Shield className="w-4 h-4" /> Regras completas
            </Link>
            <Link to="/privacidade" className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 text-center hover:bg-gray-50 flex items-center justify-center gap-2">
              <FileText className="w-4 h-4" /> Privacidade
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}