import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import Customer from '@/lib/customersDb';
import Sale from '@/lib/salesDb';
import CashbackTransaction from '@/lib/cashbackTransactionsDb';
import { useAuth } from '@/lib/AuthContext';
import { formatCurrency, formatDate, formatPhone, getCustomerForUser } from '@/lib/cashbackUtils';
import { Wallet, Clock, QrCode, User, Check, ShoppingBag, AlertTriangle, RefreshCw } from 'lucide-react';
import StatusBadge from '@/components/ui/StatusBadge';
import DeleteAccountModal from '@/components/customer/DeleteAccountModal';
import ConsentManager from '@/components/customer/ConsentManager';
import MyCodeCard from '@/components/customer/MyCodeCard';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { useRouteCache } from '@/hooks/useRouteCache';

export default function CustomerArea() {
  const { user } = useAuth();
  const [customer, setCustomer] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useRouteCache('tab', 'saldo');
  const [setupMode, setSetupMode] = useState(false);
  const [setupForm, setSetupForm] = useState({ name: user?.full_name || '', phone: '', cpf: '' });
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState(null);
  const [showDelete, setShowDelete] = useState(false);

  useEffect(() => { loadData(); }, [user]);

  const loadData = async () => {
    setLoading(true);
    try {
      const s = await (await import('@/lib/cashbackSettingsDb')).default.list();
      if (s.length > 0) setSettings(s[0]);

      if (!user?.id) { setLoading(false); return; }
      const mine = await getCustomerForUser(user);
      if (mine) {
        setCustomer(mine);
        const txs = await CashbackTransaction.filter({ customer_id: mine.id });
        setTransactions(txs.sort((a, b) => new Date(b.transaction_date) - new Date(a.transaction_date)));
        const sls = await Sale.filter({ customer_id: mine.id });
        setSales(sls.sort((a, b) => new Date(b.sale_date) - new Date(a.sale_date)));
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const { pullDistance, refreshing, onTouchStart, onTouchMove, onTouchEnd } = usePullToRefresh(loadData);

  const handleSetup = async () => {
    if (!setupForm.name || !setupForm.phone) return;
    setSaving(true);
    try {
      const { cpfToIdentifierCode } = await import('@/lib/cashbackUtils');
      const code = cpfToIdentifierCode(setupForm.cpf);
      const created = await Customer.create({
        name: setupForm.name,
        phone: setupForm.phone,
        identifier_code: code,
        available_balance: 0,
        pending_balance: 0,
        total_cashback_earned: 0,
        total_cashback_used: 0,
        is_demo: false,
      });
      setCustomer(created);
      setSetupMode(false);
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
    </div>
  );

  if (!customer && !setupMode) {
    return (
      <div className="p-4 md:p-8 max-w-md mx-auto">
        <div className="text-center py-8">
          <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <User className="w-10 h-10 text-orange-500" />
          </div>
          <h2 className="text-xl font-black text-gray-900 mb-2">Complete seu cadastro</h2>
          <p className="text-gray-500 text-sm mb-6">Para acessar seu saldo de cashback, precisamos do seu nome e telefone.</p>
          <button onClick={() => setSetupMode(true)}
            className="px-8 py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-2xl shadow-lg shadow-orange-500/30">
            Completar Cadastro
          </button>
        </div>
      </div>
    );
  }

  if (setupMode) {
    return (
      <div className="p-4 md:p-8 max-w-md mx-auto">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h2 className="font-bold text-lg mb-5">Completar Cadastro</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Nome completo *</label>
              <input value={setupForm.name} onChange={e => setSetupForm({...setupForm, name: e.target.value})}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Telefone *</label>
              <input value={setupForm.phone} onChange={e => setSetupForm({...setupForm, phone: e.target.value})}
                placeholder="(00) 00000-0000"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">CPF *</label>
              <input value={setupForm.cpf} onChange={e => setSetupForm({...setupForm, cpf: e.target.value})}
                placeholder="000.000.000-00"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm" />
            </div>
          </div>
          <button onClick={handleSetup} disabled={saving || !setupForm.name || !setupForm.phone || !setupForm.cpf}
            className="w-full mt-5 py-3 bg-orange-500 text-white font-bold rounded-xl disabled:opacity-60">
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="p-4 md:p-8 max-w-2xl mx-auto"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {(pullDistance > 0 || refreshing) && (
        <div className="flex items-center justify-center overflow-hidden" style={{ height: refreshing ? 40 : pullDistance }}>
          <RefreshCw className={`w-6 h-6 text-orange-500 ${refreshing ? 'animate-spin' : ''}`} />
        </div>
      )}
      {/* Header */}
      <div className="bg-[#0A0A0A] rounded-2xl p-5 mb-5 text-white">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-full bg-orange-500 flex items-center justify-center font-black text-xl">
            {customer.name?.charAt(0)?.toUpperCase()}
          </div>
          <div>
            <div className="font-black text-base">{customer.name}</div>
            <div className="text-gray-400 text-xs">{formatPhone(customer.phone)}</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white/10 rounded-xl p-3">
            <div className="text-xs text-gray-400 mb-1 flex items-center gap-1"><Wallet className="w-3 h-3" /> Disponível</div>
            <div className="text-xl font-black text-green-400">{formatCurrency(customer.available_balance)}</div>
          </div>
          <div className="bg-white/10 rounded-xl p-3">
            <div className="text-xs text-gray-400 mb-1 flex items-center gap-1"><Clock className="w-3 h-3" /> Pendente</div>
            <div className="text-xl font-black text-yellow-400">{formatCurrency(customer.pending_balance)}</div>
          </div>
        </div>
        {settings && (
          <div className="mt-3 text-xs text-gray-400">
            Use seu cashback em compras acima de {formatCurrency(settings.min_purchase_to_use)}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-5">
        {[['saldo', 'Saldo'], ['codigo', 'Código'], ['historico', 'Compras'], ['extrato', 'Cashback'], ['conta', 'Conta']].map(([v, l]) => (
          <button key={v} onClick={() => setTab(v)}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${tab === v ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}>
            {l}
          </button>
        ))}
      </div>

      {tab === 'saldo' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <h3 className="font-bold text-gray-900 mb-3">Resumo</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between py-2 border-b border-gray-50">
                <span className="text-gray-500">Total gerado</span>
                <span className="font-bold text-gray-900">{formatCurrency(customer.total_cashback_earned)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-50">
                <span className="text-gray-500">Total utilizado</span>
                <span className="font-bold text-gray-900">{formatCurrency(customer.total_cashback_used)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-50">
                <span className="text-gray-500">Saldo disponível</span>
                <span className="font-bold text-green-600 text-base">{formatCurrency(customer.available_balance)}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-gray-500">Saldo pendente</span>
                <span className="font-bold text-yellow-600">{formatCurrency(customer.pending_balance)}</span>
              </div>
            </div>
          </div>
          {settings && (
            <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 text-sm text-orange-800">
              <div className="font-bold mb-2">Regras do programa</div>
              <ul className="space-y-1 text-xs">
                <li>• Ganhe {settings.cashback_percentage}% de cashback em suas compras</li>
                <li>• Use o cashback em compras acima de {formatCurrency(settings.min_purchase_to_use)}</li>
                <li>• Pague até {settings.max_cashback_payment_percentage}% da compra com cashback</li>
                <li>• Saldo válido por {settings.balance_validity_days} dias</li>
                {settings.release_days > 0 && <li>• Cashback liberado após {settings.release_days} dias</li>}
              </ul>
            </div>
          )}
        </div>
      )}

      {tab === 'codigo' && (
        <MyCodeCard customer={customer} />
      )}

      {tab === 'historico' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {sales.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <ShoppingBag className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Nenhuma compra registrada</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {sales.map(s => (
                <div key={s.id} className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-sm text-gray-900">Venda #{s.sale_number}</div>
                    <div className="text-xs text-gray-400">{formatDate(s.sale_date)}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-gray-900">{formatCurrency(s.total_amount)}</div>
                    {s.cashback_amount > 0 && <div className="text-xs text-green-600 font-semibold">+{formatCurrency(s.cashback_amount)} cashback</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'extrato' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {transactions.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Wallet className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Nenhuma movimentação de cashback</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {transactions.map(tx => (
                <div key={tx.id} className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-sm text-gray-900">
                      {tx.type === 'gerado' ? 'Cashback gerado' : tx.type === 'utilizado' ? 'Cashback utilizado' : tx.type}
                    </div>
                    <div className="text-xs text-gray-400">{formatDate(tx.transaction_date)}{tx.sale_number ? ` · Venda #${tx.sale_number}` : ''}</div>
                  </div>
                  <div className="text-right flex items-center gap-2">
                    <StatusBadge status={tx.status} />
                    <span className={`font-bold text-sm ${tx.amount > 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {tx.amount > 0 ? '+' : ''}{formatCurrency(tx.amount)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'conta' && (
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-bold text-gray-900 mb-3">Minha Conta</h3>
          <div className="space-y-2 text-sm mb-5">
            <div className="flex justify-between py-2 border-b border-gray-50">
              <span className="text-gray-500">Nome</span>
              <span className="font-semibold">{customer.name}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-50">
              <span className="text-gray-500">Telefone</span>
              <span className="font-semibold">{formatPhone(customer.phone)}</span>
            </div>
            {customer.email && (
              <div className="flex justify-between py-2 border-b border-gray-50">
                <span className="text-gray-500">E-mail</span>
                <span className="font-semibold text-xs">{customer.email}</span>
              </div>
            )}
          </div>
          <div className="border-t border-gray-100 pt-4 mb-4">
            <h4 className="font-bold text-gray-900 mb-1 text-sm">Consentimentos e Privacidade</h4>
            <p className="text-xs text-gray-500 mb-3">Gerencie suas autorizações de uso de dados e comunicações.</p>
            <ConsentManager customer={customer} />
          </div>
          <div className="border-t border-gray-100 pt-4">
            <button onClick={() => setShowDelete(true)}
              className="flex items-center gap-2 text-red-600 text-sm font-semibold hover:text-red-700">
              <AlertTriangle className="w-4 h-4" /> Excluir minha conta
            </button>
          </div>
        </div>
      )}

      {showDelete && <DeleteAccountModal customer={customer} onClose={() => setShowDelete(false)} />}
    </div>
  );
}