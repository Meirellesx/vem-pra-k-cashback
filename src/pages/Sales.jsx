import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import Customer from '@/lib/customersDb';
import { useAuth } from '@/lib/AuthContext';
import { formatCurrency, formatDate, formatPhone, getSettings, calculateCashback, getAvailableDate, getExpiryDate, createAuditLog, getMyCustomer, isOwnCustomer } from '@/lib/cashbackUtils';
import { Search, CheckCircle, AlertTriangle, User, Plus, DollarSign, ShoppingBag } from 'lucide-react';
import { PAYMENT_METHODS } from '@/lib/constants';
import { getOperator } from '@/lib/internalAuth';
import DrawerSelect from '@/components/mobile/DrawerSelect';

const today = () => new Date().toISOString().split('T')[0];

export default function Sales() {
  const { user } = useAuth();
  const operator = getOperator(user);
  const [settings, setSettings] = useState(null);
  const [step, setStep] = useState('search'); // search | details | confirm | done
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [newCustomerMode, setNewCustomerMode] = useState(false);
  const [newCustomerForm, setNewCustomerForm] = useState({ name: '', phone: '', cpf: '' });
  const [form, setForm] = useState({ sale_number: '', total_amount: '', payment_method: 'pix', sale_date: today(), notes: '' });
  const [cashbackCalc, setCashbackCalc] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(null);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [myCustomer, setMyCustomer] = useState(null);

  useEffect(() => {
    loadInit();
  }, []);

  const loadInit = async () => {
    const [s, cats, mine] = await Promise.all([
      getSettings(),
      base44.entities.ProductCategory.filter({ is_active: true }),
      getMyCustomer(operator),
    ]);
    setSettings(s);
    setCategories(cats);
    setMyCustomer(mine);
  };

  const handleSearch = async (q) => {
    setSearch(q);
    if (q.length < 2) { setSearchResults([]); return; }
    const cleaned = q.replace(/\D/g, '');
    const all = await Customer.list('-created_date', 100);
    const results = all.filter(c => c.is_active !== false && !c.is_demo && (
      c.name?.toLowerCase().includes(q.toLowerCase()) ||
      (cleaned && c.phone?.replace(/\D/g, '').includes(cleaned)) ||
      (cleaned && c.identifier_code && c.identifier_code.replace(/\D/g, '').includes(cleaned))
    ));
    setSearchResults(results.slice(0, 5));
  };

  const selectCustomer = (c) => {
    // Regra: o funcionário não pode registrar compra para si mesmo.
    if (isOwnCustomer(operator, c, myCustomer)) {
      setError('⚠️ Você não pode registrar uma venda para você mesmo. Peça a outro operador.');
      return;
    }
    setSelectedCustomer(c);
    setSearchResults([]);
    setSearch(c.name);
    setStep('details');
    setError('');
  };

  const handleCreateCustomer = async () => {
    if (!newCustomerForm.name || !newCustomerForm.phone) return;
    if (isOwnCustomer(operator, { name: newCustomerForm.name, email: newCustomerForm.email }, myCustomer)) {
      setError('⚠️ Você não pode cadastrar um cliente com os seus próprios dados. Peça a outro operador.');
      return;
    }
    try {
      const { cpfToIdentifierCode } = await import('@/lib/cashbackUtils');
      const code = cpfToIdentifierCode(newCustomerForm.cpf);
      const created = await Customer.create({
        ...newCustomerForm, identifier_code: code,
        available_balance: 0, pending_balance: 0,
        total_cashback_earned: 0, total_cashback_used: 0, is_demo: false,
      });
      await createAuditLog(operator, 'create_customer', 'Customer', created.id, `Novo cliente via caixa: ${newCustomerForm.name}`, '', null, newCustomerForm);
      selectCustomer(created);
      setNewCustomerMode(false);
    } catch (e) { setError('Erro ao cadastrar cliente.'); }
  };

  const calcCashback = useCallback(() => {
    if (!settings || !form.total_amount) return;
    const total = parseFloat(form.total_amount) || 0;
    const cat = categories.find(c => c.id === selectedCategory);
    const pct = cat?.cashback_percentage_override ?? settings.cashback_percentage;
    const generates = !cat || cat.generates_cashback !== false;
    const eligible = total; // valor pago com cashback não gera cashback
    const amount = generates ? calculateCashback(eligible, pct) : 0;
    const status = settings.release_days > 0 ? 'pendente' : 'disponivel';
    const availDate = getAvailableDate(settings.release_days);
    const expiryDate = getExpiryDate(settings.balance_validity_days);
    setCashbackCalc({ amount, pct, generates, status, availDate, expiryDate, eligible });
  }, [settings, form.total_amount, selectedCategory, categories]);

  useEffect(() => { calcCashback(); }, [calcCashback]);

  const handleSubmit = async () => {
    setError('');
    if (!form.sale_number || !form.total_amount || !form.payment_method) {
      setError('Preencha todos os campos obrigatórios.'); return;
    }
    // Check duplicate
    const existing = await base44.entities.Sale.filter({ sale_number: form.sale_number });
    if (existing.length > 0) {
      setError(`⚠️ Venda #${form.sale_number} já foi registrada! Verifique o número.`); return;
    }
    setStep('confirm');
  };

  const handleConfirm = async () => {
    setSaving(true);
    setError('');
    try {
      const total = parseFloat(form.total_amount);
      const cbAmount = cashbackCalc?.amount || 0;
      const cashbackStatus = cashbackCalc?.status || 'disponivel';

      // Create sale
      const sale = await base44.entities.Sale.create({
        sale_number: form.sale_number,
        customer_id: selectedCustomer?.id || '',
        customer_name: selectedCustomer?.name || '',
        total_amount: total,
        eligible_amount: total,
        cashback_amount: cbAmount,
        cashback_used: 0,
        payment_method: form.payment_method,
        sale_date: form.sale_date,
        category_id: selectedCategory || '',
        status: 'concluida',
        cashback_generated: cbAmount > 0,
        operator_id: operator?.id || '',
        notes: form.notes,
        is_demo: false,
      });

      let txId = null;
      if (cbAmount > 0 && selectedCustomer) {
        // Create cashback transaction
        const tx = await base44.entities.CashbackTransaction.create({
          customer_id: selectedCustomer.id,
          customer_name: selectedCustomer.name,
          sale_id: sale.id,
          sale_number: form.sale_number,
          amount: cbAmount,
          type: 'gerado',
          status: cashbackStatus,
          transaction_date: form.sale_date,
          available_date: cashbackCalc.availDate,
          expiry_date: cashbackCalc.expiryDate,
          operator_id: operator?.id || '',
          is_demo: false,
        });
        txId = tx.id;

        // Update customer balance
        const balanceUpdate = cashbackStatus === 'disponivel'
          ? { available_balance: (selectedCustomer.available_balance || 0) + cbAmount, total_cashback_earned: (selectedCustomer.total_cashback_earned || 0) + cbAmount }
          : { pending_balance: (selectedCustomer.pending_balance || 0) + cbAmount, total_cashback_earned: (selectedCustomer.total_cashback_earned || 0) + cbAmount };
        await Customer.update(selectedCustomer.id, balanceUpdate);

        // Update sale with transaction id
        await base44.entities.Sale.update(sale.id, { cashback_transaction_id: txId });
      }

      await createAuditLog(operator, 'register_sale', 'Sale', sale.id, `Venda #${form.sale_number} registrada para ${selectedCustomer?.name || 'cliente'} — ${formatCurrency(total)}`, '', null, sale);

      setDone({ sale, cashback: cbAmount, customer: selectedCustomer, cashbackStatus });
      setStep('done');
    } catch (e) {
      setError('Erro ao registrar venda: ' + e.message);
      setStep('details');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setStep('search'); setSearch(''); setSelectedCustomer(null);
    setForm({ sale_number: '', total_amount: '', payment_method: 'pix', sale_date: today(), notes: '' });
    setCashbackCalc(null); setDone(null); setError('');
  };

  if (step === 'done' && done) {
    return (
      <div className="p-4 md:p-8 max-w-lg mx-auto">
        <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-xl font-black text-gray-900 mb-2">Venda Registrada!</h2>
          <p className="text-gray-500 text-sm mb-6">Venda #{done.sale.sale_number} registrada com sucesso.</p>
          <div className="space-y-3 text-left mb-6">
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-500 text-sm">Cliente</span>
              <span className="font-semibold text-sm">{done.customer?.name || '—'}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-500 text-sm">Valor da venda</span>
              <span className="font-bold text-lg">{formatCurrency(done.sale.total_amount)}</span>
            </div>
            {done.cashback > 0 && (
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500 text-sm">Cashback gerado</span>
                <span className={`font-bold text-lg ${done.cashbackStatus === 'disponivel' ? 'text-green-600' : 'text-yellow-600'}`}>
                  + {formatCurrency(done.cashback)}
                </span>
              </div>
            )}
            {done.cashback > 0 && (
              <div className="flex justify-between py-2">
                <span className="text-gray-500 text-sm">Status do cashback</span>
                <span className={`text-sm font-semibold px-2 py-0.5 rounded-full ${done.cashbackStatus === 'disponivel' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                  {done.cashbackStatus === 'disponivel' ? '✅ Disponível' : '⏳ Pendente'}
                </span>
              </div>
            )}
            {done.cashback === 0 && <p className="text-sm text-gray-400 text-center">Nenhum cashback gerado para esta venda.</p>}
          </div>
          <button onClick={handleReset} className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-sm shadow-lg shadow-orange-500/30">
            Nova Venda
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-gray-900">Registrar Venda</h1>
        <p className="text-gray-500 text-sm">Tela do operador de caixa</p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* STEP: SEARCH */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-4">
        <div className="flex items-center gap-2 mb-4">
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${selectedCustomer ? 'bg-green-500 text-white' : 'bg-orange-500 text-white'}`}>1</div>
          <h3 className="font-bold text-gray-900">Identificar Cliente</h3>
        </div>

        {selectedCustomer ? (
          <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl p-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-bold">
                {selectedCustomer.name?.charAt(0)?.toUpperCase()}
              </div>
              <div>
                <div className="font-bold text-gray-900 text-sm">{selectedCustomer.name}</div>
                <div className="text-xs text-gray-500">{formatPhone(selectedCustomer.phone)}</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-500">Saldo disponível</div>
              <div className="font-black text-green-600 text-sm">{formatCurrency(selectedCustomer.available_balance)}</div>
            </div>
            <button onClick={() => { setSelectedCustomer(null); setStep('search'); setSearch(''); }}
              className="ml-3 text-gray-400 hover:text-gray-600 p-1">
              ✕
            </button>
          </div>
        ) : !newCustomerMode ? (
          <div>
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                value={search}
                onChange={e => handleSearch(e.target.value)}
                placeholder="Nome, telefone ou CPF do cliente..."
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
              />
            </div>
            {searchResults.length > 0 && (
              <div className="border border-gray-200 rounded-xl overflow-hidden mb-2">
                {searchResults.map(c => (
                  <button key={c.id} onClick={() => selectCustomer(c)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-orange-50 text-left border-b border-gray-100 last:border-0 transition-colors">
                    <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-bold text-sm flex-shrink-0">
                      {c.name?.charAt(0)?.toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-sm text-gray-900">{c.name}</div>
                      <div className="text-xs text-gray-400">{formatPhone(c.phone)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-green-600 font-bold">{formatCurrency(c.available_balance)}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
            <button onClick={() => setNewCustomerMode(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 border border-dashed border-orange-300 rounded-xl text-orange-500 text-sm font-semibold hover:bg-orange-50 transition-colors">
              <Plus className="w-4 h-4" /> Cadastrar novo cliente
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-gray-500 mb-3">Cadastro rápido de cliente</p>
            <input value={newCustomerForm.name} onChange={e => setNewCustomerForm({...newCustomerForm, name: e.target.value})}
              placeholder="Nome completo *"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm" />
            <input value={newCustomerForm.phone} onChange={e => setNewCustomerForm({...newCustomerForm, phone: e.target.value})}
              placeholder="Telefone * (00) 00000-0000"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm" />
            <input value={newCustomerForm.cpf} onChange={e => setNewCustomerForm({...newCustomerForm, cpf: e.target.value})}
              placeholder="CPF * 000.000.000-00"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm" />
            <div className="flex gap-2">
              <button onClick={() => setNewCustomerMode(false)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600">Cancelar</button>
              <button onClick={handleCreateCustomer} disabled={!newCustomerForm.name || !newCustomerForm.phone || !newCustomerForm.cpf}
                className="flex-1 py-2.5 bg-orange-500 text-white rounded-xl text-sm font-bold disabled:opacity-60">Cadastrar</button>
            </div>
          </div>
        )}
      </div>

      {/* STEP: SALE DETAILS */}
      {(step === 'details' || step === 'confirm') && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-4">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-6 h-6 rounded-full bg-orange-500 text-white flex items-center justify-center text-xs font-bold">2</div>
            <h3 className="font-bold text-gray-900">Dados da Venda</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Número da Venda *</label>
              <input value={form.sale_number} onChange={e => setForm({...form, sale_number: e.target.value})}
                placeholder="Ex: 001234"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm font-mono" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Data *</label>
              <input type="date" value={form.sale_date} onChange={e => setForm({...form, sale_date: e.target.value})}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Valor Total (R$) *</label>
              <input type="number" min="0" step="0.01" value={form.total_amount} onChange={e => setForm({...form, total_amount: e.target.value})}
                placeholder="0,00"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm text-lg font-bold" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Forma de Pagamento *</label>
              <DrawerSelect
                value={form.payment_method}
                onChange={(v) => setForm({...form, payment_method: v})}
                label="Forma de Pagamento"
                className="w-full px-4 py-3 text-sm min-w-0"
                options={Object.entries(PAYMENT_METHODS).map(([k, v]) => ({ value: k, label: v }))}
              />
            </div>
            {categories.length > 0 && (
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Categoria</label>
                <select value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm">
                  <option value="">— Todas as categorias (padrão) —</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CASHBACK PREVIEW */}
      {step === 'details' && cashbackCalc && form.total_amount && (
        <div className={`rounded-2xl p-5 mb-4 border ${cashbackCalc.generates && cashbackCalc.amount > 0 ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
          <h4 className="font-bold text-sm mb-3 text-gray-700">Cashback Calculado</h4>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-gray-500">Percentual</div>
              <div className="font-bold text-gray-900">{cashbackCalc.pct}%</div>
            </div>
            <div className="text-3xl font-black text-green-600">
              {cashbackCalc.generates && cashbackCalc.amount > 0 ? `+ ${formatCurrency(cashbackCalc.amount)}` : 'R$ 0,00'}
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-500">Status</div>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cashbackCalc.status === 'disponivel' ? 'bg-green-200 text-green-800' : 'bg-yellow-200 text-yellow-800'}`}>
                {cashbackCalc.status === 'disponivel' ? 'Disponível imediatamente' : `Pendente — libera em ${formatDate(cashbackCalc.availDate)}`}
              </span>
            </div>
          </div>
          {(!cashbackCalc.generates) && <p className="text-xs text-gray-500 mt-2">⚠️ Esta categoria não gera cashback.</p>}
        </div>
      )}

      {/* CONFIRM MODAL */}
      {step === 'confirm' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="font-black text-lg mb-4">Confirmar Venda</h3>
            <div className="space-y-2 mb-5 text-sm">
              <div className="flex justify-between py-1.5 border-b border-gray-100">
                <span className="text-gray-500">Venda #</span>
                <span className="font-mono font-bold">{form.sale_number}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-gray-100">
                <span className="text-gray-500">Cliente</span>
                <span className="font-semibold">{selectedCustomer?.name || '—'}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-gray-100">
                <span className="text-gray-500">Valor</span>
                <span className="font-bold text-lg">{formatCurrency(parseFloat(form.total_amount))}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-gray-100">
                <span className="text-gray-500">Pagamento</span>
                <span className="font-semibold">{PAYMENT_METHODS[form.payment_method]}</span>
              </div>
              {cashbackCalc?.amount > 0 && (
                <div className="flex justify-between py-1.5">
                  <span className="text-gray-500">Cashback gerado</span>
                  <span className="font-black text-green-600 text-base">+ {formatCurrency(cashbackCalc.amount)}</span>
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep('details')} className="flex-1 py-3 border border-gray-200 rounded-xl text-sm font-semibold">Voltar</button>
              <button onClick={handleConfirm} disabled={saving}
                className="flex-1 py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-sm disabled:opacity-60">
                {saving ? 'Registrando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {step === 'details' && (
        <button onClick={handleSubmit}
          className="w-full py-4 bg-orange-500 hover:bg-orange-600 text-white font-black text-base rounded-2xl shadow-lg shadow-orange-500/30 transition-all">
          Registrar Venda →
        </button>
      )}
    </div>
  );
}