import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { createAuditLog } from '@/lib/cashbackUtils';
import CashbackSettings from '@/lib/cashbackSettingsDb';
import { Save, Settings as SettingsIcon, Info } from 'lucide-react';

export default function Settings() {
  const { user } = useAuth();
  const [form, setForm] = useState({
    cashback_percentage: 5,
    min_purchase_to_use: 50,
    max_cashback_payment_percentage: 50,
    release_days: 0,
    balance_validity_days: 365,
    is_active: true,
    program_name: 'Vem Pra K Cashback',
  });
  const [settingsId, setSettingsId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadSettings(); }, []);

  const loadSettings = async () => {
    setLoading(true);
    const data = await CashbackSettings.list();
    if (data.length > 0) {
      setForm({ ...form, ...data[0] });
      setSettingsId(data[0].id);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = { ...form, updated_by: user?.id || '' };
      if (settingsId) {
        const before = await CashbackSettings.get(settingsId);
        await CashbackSettings.update(settingsId, payload);
        await createAuditLog(user, 'update_settings', 'CashbackSettings', settingsId, 'Configurações do programa atualizadas', '', before, payload);
      } else {
        const created = await CashbackSettings.create(payload);
        setSettingsId(created.id);
        await createAuditLog(user, 'create_settings', 'CashbackSettings', created.id, 'Configurações iniciais criadas', '', null, payload);
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const Field = ({ label, hint, children }) => (
    <div className="py-4 border-b border-gray-100 last:border-0">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <div className="flex-1">
          <label className="block font-semibold text-gray-800 text-sm">{label}</label>
          {hint && <p className="text-xs text-gray-400 mt-0.5">{hint}</p>}
        </div>
        <div className="sm:w-56">{children}</div>
      </div>
    </div>
  );

  if (loading) return (
    <div className="flex items-center justify-center h-40">
      <div className="w-8 h-8 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Configurações do Programa</h1>
          <p className="text-gray-500 text-sm">Somente administradores podem alterar estas configurações</p>
        </div>
        <SettingsIcon className="w-6 h-6 text-gray-400" />
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-4">
        <h2 className="font-bold text-gray-900 mb-2">Status do Programa</h2>
        <div className="flex items-center justify-between">
          <div>
            <div className="font-semibold text-sm text-gray-700">Programa ativo</div>
            <div className="text-xs text-gray-400">Quando desativado, nenhum cashback é gerado ou utilizado</div>
          </div>
          <button onClick={() => setForm({...form, is_active: !form.is_active})}
            className={`relative w-12 h-6 rounded-full transition-colors ${form.is_active ? 'bg-orange-500' : 'bg-gray-300'}`}>
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${form.is_active ? 'translate-x-6' : 'translate-x-0'}`} />
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-4">
        <h2 className="font-bold text-gray-900 mb-1">Geração de Cashback</h2>

        <Field label="Percentual de cashback (%)" hint="Percentual do valor da compra convertido em cashback">
          <div className="flex items-center gap-2">
            <input type="number" min="0" max="100" step="0.1" value={form.cashback_percentage}
              onChange={e => setForm({...form, cashback_percentage: parseFloat(e.target.value) || 0})}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm" />
            <span className="text-gray-500 text-sm">%</span>
          </div>
        </Field>

        <Field label="Prazo para liberação (dias)" hint="0 = liberação imediata. Ex: 7 = libera após 7 dias">
          <input type="number" min="0" value={form.release_days}
            onChange={e => setForm({...form, release_days: parseInt(e.target.value) || 0})}
            className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm" />
        </Field>

        <Field label="Validade do saldo (dias)" hint="Após quantos dias o saldo disponível expira">
          <input type="number" min="1" value={form.balance_validity_days}
            onChange={e => setForm({...form, balance_validity_days: parseInt(e.target.value) || 365})}
            className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm" />
        </Field>
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-4">
        <h2 className="font-bold text-gray-900 mb-1">Utilização de Cashback</h2>

        <Field label="Valor mínimo de compra (R$)" hint="O cliente só pode usar cashback se a compra atingir este valor">
          <input type="number" min="0" step="0.01" value={form.min_purchase_to_use}
            onChange={e => setForm({...form, min_purchase_to_use: parseFloat(e.target.value) || 0})}
            className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm" />
        </Field>

        <Field label="Máximo pagável com cashback (%)" hint="Percentual máximo do valor da compra que pode ser pago com cashback">
          <div className="flex items-center gap-2">
            <input type="number" min="1" max="100" value={form.max_cashback_payment_percentage}
              onChange={e => setForm({...form, max_cashback_payment_percentage: parseFloat(e.target.value) || 50})}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm" />
            <span className="text-gray-500 text-sm">%</span>
          </div>
        </Field>
      </div>

      {/* Preview */}
      <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 mb-5 text-sm">
        <div className="flex items-center gap-2 mb-2">
          <Info className="w-4 h-4 text-orange-600" />
          <span className="font-bold text-orange-800">Exemplo com as configurações atuais</span>
        </div>
        <div className="text-orange-700 space-y-1 text-xs">
          <p>• Compra de <strong>R$ 100,00</strong> gera <strong>R$ {form.cashback_percentage},00</strong> de cashback ({form.cashback_percentage}%)</p>
          <p>• Cashback fica {form.release_days === 0 ? 'disponível imediatamente' : `pendente por ${form.release_days} dias`}</p>
          <p>• Saldo expira em <strong>{form.balance_validity_days} dias</strong></p>
          <p>• Compra mínima para usar: <strong>R$ {form.min_purchase_to_use.toFixed(2)}</strong></p>
          <p>• Máx. {form.max_cashback_payment_percentage}% da compra pode ser pago com cashback</p>
        </div>
      </div>

      <button onClick={handleSave} disabled={saving}
        className="w-full py-4 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white font-black text-base rounded-2xl shadow-lg shadow-orange-500/30 flex items-center justify-center gap-2">
        <Save className="w-5 h-5" />
        {saving ? 'Salvando...' : saved ? '✅ Salvo!' : 'Salvar Configurações'}
      </button>
    </div>
  );
}