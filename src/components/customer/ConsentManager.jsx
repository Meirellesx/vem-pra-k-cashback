import React, { useState, useEffect } from 'react';
import ConsentRecord from '@/lib/consentRecordsDb';
import Customer from '@/lib/customersDb';
import { Shield, Bell, FileText, Check, Loader2 } from 'lucide-react';

const CONSENTS = [
  { type: 'termos_uso', label: 'Termos de Uso', icon: FileText, desc: 'Aceito os termos e condições de uso do programa de cashback.' },
  { type: 'politica_privacidade', label: 'Política de Privacidade', icon: Shield, desc: 'Concordo com o tratamento dos meus dados conforme a política de privacidade.' },
  { type: 'comunicacoes_promocionais', label: 'Comunicações Promocionais', icon: Bell, desc: 'Autorizo o envio de ofertas e novidades por e-mail, telefone e WhatsApp.' },
];

export default function ConsentManager({ customer }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);

  useEffect(() => {
    if (!customer?.id) return;
    loadRecords();
  }, [customer?.id]);

  const loadRecords = async () => {
    setLoading(true);
    try {
      const all = await ConsentRecord.filter({ customer_id: customer.id });
      // Mantém apenas o registro mais recente de cada tipo.
      const byType = {};
      all.forEach((r) => {
        if (!byType[r.consent_type]) byType[r.consent_type] = r;
      });
      setRecords(byType);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const toggle = async (consent, accept) => {
    setBusy(consent.type);
    try {
      const now = new Date().toISOString();
      const existing = records[consent.type];
      if (existing) {
        await ConsentRecord.update(existing.id, { accepted: accept, consent_date: now });
      } else {
        const created = await ConsentRecord.create({
          customer_id: customer.id,
          customer_name: customer.name,
          consent_type: consent.type,
          accepted: accept,
          consent_date: now,
        });
        records[consent.type] = created;
      }
      setRecords({ ...records, [consent.type]: { ...(records[consent.type] || {}), accepted: accept } });

      // Sincroniza o flag de promoções no perfil do cliente.
      if (consent.type === 'comunicacoes_promocionais') {
        await Customer.update(customer.id, { accepts_promotions: accept });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="w-5 h-5 text-orange-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {CONSENTS.map((c) => {
        const Icon = c.icon;
        const rec = records[c.type];
        const accepted = !!rec?.accepted;
        const isBusy = busy === c.type;
        return (
          <div key={c.type} className="border border-gray-100 rounded-xl p-3">
            <div className="flex items-start gap-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${accepted ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm text-gray-900">{c.label}</div>
                <p className="text-xs text-gray-500 mt-0.5">{c.desc}</p>
                {rec?.consent_date && (
                  <p className="text-[10px] text-gray-400 mt-1">
                    {accepted ? 'Aceito em ' : 'Revogado em '}
                    {new Date(rec.consent_date).toLocaleDateString('pt-BR')}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={() => toggle(c, !accepted)}
              disabled={isBusy}
              className={`w-full mt-3 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-60 ${
                accepted
                  ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  : 'bg-orange-500 text-white hover:bg-orange-600'
              }`}
            >
              {isBusy ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : accepted ? (
                <><Check className="w-4 h-4" /> Aceito — tocar para revogar</>
              ) : (
                'Aceitar'
              )}
            </button>
          </div>
        );
      })}
    </div>
  );
}