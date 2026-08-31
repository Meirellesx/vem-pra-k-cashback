import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { formatCurrency } from '@/lib/cashbackUtils';
import { Shield, Percent, Clock, Wallet, AlertCircle } from 'lucide-react';

export default function ProgramRules() {
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    // Via função pública: funciona tanto para visitantes quanto para logados.
    base44.functions.invoke('public-cashback-lookup', { op: 'settings' })
      .then((res) => {
        const d = res?.data ?? res;
        if (d?.settings) setSettings(d.settings);
      })
      .catch(() => {});
  }, []);

  const rules = settings ? [
    { icon: Percent, title: `${settings.cashback_percentage}% de cashback`, desc: `Você recebe ${settings.cashback_percentage}% do valor de cada compra elegível de volta como cashback.` },
    { icon: Clock, title: settings.release_days === 0 ? 'Liberação imediata' : `Liberação em ${settings.release_days} dias`, desc: settings.release_days === 0 ? 'Seu cashback fica disponível imediatamente após a compra.' : `O cashback fica pendente por ${settings.release_days} dias antes de ser liberado para uso.` },
    { icon: Wallet, title: `Validade de ${settings.balance_validity_days} dias`, desc: `O saldo disponível é válido por ${settings.balance_validity_days} dias a partir da data de liberação.` },
    { icon: AlertCircle, title: `Compra mínima de ${formatCurrency(settings.min_purchase_to_use)}`, desc: `Para usar seu cashback, a compra deve ser de no mínimo ${formatCurrency(settings.min_purchase_to_use)}.` },
    { icon: Shield, title: `Máximo ${settings.max_cashback_payment_percentage}% em cashback`, desc: `Você pode pagar até ${settings.max_cashback_payment_percentage}% do valor da compra com cashback. O restante deve ser pago normalmente.` },
  ] : [];

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
          <Shield className="w-8 h-8 text-orange-600" />
        </div>
        <h1 className="text-2xl font-black text-gray-900">Regras do Programa</h1>
        <p className="text-gray-500 text-sm mt-1">Vem Pra K Cashback — como funciona</p>
      </div>

      <div className="bg-orange-500 text-white rounded-2xl p-5 mb-6 text-center shadow-lg shadow-orange-500/30">
        <div className="text-4xl font-black mb-1">{settings?.cashback_percentage || 5}%</div>
        <div className="text-orange-100 text-sm font-semibold">de cashback em suas compras</div>
      </div>

      <div className="space-y-3 mb-8">
        {rules.map((rule, i) => (
          <div key={i} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex gap-4">
            <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <rule.icon className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <div className="font-bold text-gray-900 text-sm">{rule.title}</div>
              <div className="text-gray-500 text-xs mt-0.5">{rule.desc}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-gray-50 rounded-2xl p-5 border border-gray-200">
        <h2 className="font-bold text-gray-900 mb-3">Como funciona?</h2>
        <ol className="space-y-3 text-sm text-gray-600">
          <li className="flex gap-3"><span className="w-6 h-6 rounded-full bg-orange-500 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">1</span><span>Faça suas compras na Vem Pra K e informe seu cadastro no caixa.</span></li>
          <li className="flex gap-3"><span className="w-6 h-6 rounded-full bg-orange-500 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">2</span><span>O cashback é calculado automaticamente e creditado na sua conta.</span></li>
          <li className="flex gap-3"><span className="w-6 h-6 rounded-full bg-orange-500 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">3</span><span>Quando quiser usar, apresente seu código no caixa e desconte no pagamento.</span></li>
          <li className="flex gap-3"><span className="w-6 h-6 rounded-full bg-orange-500 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">4</span><span>Fique de olho no prazo de validade para não perder seu saldo!</span></li>
        </ol>
      </div>
    </div>
  );
}