import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import Customer from '@/lib/customersDb';
import CashbackTransaction from '@/lib/cashbackTransactionsDb';
import CashbackRedemption from '@/lib/redemptionsDb';
import { useAuth } from '@/lib/AuthContext';
import { formatCurrency, formatDate, formatPhone, getSettings, createAuditLog, getMyCustomer, isOwnCustomer } from '@/lib/cashbackUtils';
import { Search, Wallet, Clock, CheckCircle, AlertTriangle, ShoppingCart } from 'lucide-react';
import { getOperator } from '@/lib/internalAuth';
import StatusBadge from '@/components/ui/StatusBadge';
import RedemptionSuccessModal from '@/components/cashback/RedemptionSuccessModal';

export default function CashbackLookup() {
  const { user } = useAuth();
  const operator = getOperator(user);
  const [settings, setSettings] = useState(null);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [customer, setCustomer] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [redeemMode, setRedeemMode] = useState(false);
  const [redeemAmount, setRedeemAmount] = useState('');
  const [redeemSaleNumber, setRedeemSaleNumber] = useState('');
  const [redeemSaleTotal, setRedeemSaleTotal] = useState('');
  const [confirmRedeem, setConfirmRedeem] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [verifyCode, setVerifyCode] = useState('');
  const [verifyError, setVerifyError] = useState('');
  const [myCustomer, setMyCustomer] = useState(null);
  const [redeemResult, setRedeemResult] = useState(null);

  useEffect(() => { loadSettings(); }, []);

  const loadSettings = async () => {
    const s = await getSettings();
    setSettings(s);
    setMyCustomer(await getMyCustomer(operator));
  };

  const handleSearch = async (q) => {
    setSearch(q);
    if (q.length < 2) { setSearchResults([]); return; }
    const cleaned = q.replace(/\D/g, '');
    const all = await Customer.list('-created_date', 100);
    const results = all.filter(c => !c.is_demo && c.is_active !== false && (
      c.name?.toLowerCase().includes(q.toLowerCase()) ||
      c.email?.toLowerCase().includes(q.toLowerCase()) ||
      (cleaned && c.phone?.replace(/\D/g, '').includes(cleaned)) ||
      (c.identifier_code && c.identifier_code.toLowerCase().includes(q.toLowerCase())) ||
      (cleaned && c.identifier_code && c.identifier_code.replace(/\D/g, '').includes(cleaned))
    ));
    setSearchResults(results.slice(0, 5));
  };

  const selectCustomer = async (c) => {
    // Regra: o funcionário não pode resgatar cashback do próprio cliente.
    if (isOwnCustomer(operator, c, myCustomer)) {
      setError('⚠️ Você não pode consultar/resgatar cashback do seu próprio cliente. Peça a outro operador.');
      setSearchResults([]);
      return;
    }
    setCustomer(c);
    setSearchResults([]);
    setSearch(c.name);
    setError('');
    setSuccess('');
    setLoading(true);
    const txs = await CashbackTransaction.filter({ customer_id: c.id });
    const sorted = txs.sort((a, b) => new Date(b.transaction_date) - new Date(a.transaction_date));
    setTransactions(sorted);
    setLoading(false);
  };

  const availableTransactions = transactions.filter(t => t.status === 'disponivel' && ((Number(t.amount) || 0) - (Number(t.used_amount) || 0)) > 0).sort((a, b) => new Date(a.transaction_date) - new Date(b.transaction_date));

  const maxRedeemable = () => {
    if (!settings || !redeemSaleTotal) return 0;
    const total = parseFloat(redeemSaleTotal) || 0;
    const maxPct = settings.max_cashback_payment_percentage / 100;
    const maxFromSale = total * maxPct;
    return Math.min(customer?.available_balance || 0, maxFromSale);
  };

  const handleRedeemSubmit = async () => {
    setError('');
    const amount = parseFloat(redeemAmount) || 0;
    const saleTotal = parseFloat(redeemSaleTotal) || 0;

    if (!redeemSaleNumber) { setError('Informe o número da venda.'); return; }
    if (!saleTotal) { setError('Informe o valor total da compra.'); return; }
    if (!amount || amount <= 0) { setError('Informe o valor de cashback a usar.'); return; }

    if (saleTotal < (settings?.min_purchase_to_use || 0)) {
      setError(`⚠️ Valor mínimo para usar cashback: ${formatCurrency(settings?.min_purchase_to_use)}. Esta compra não atinge o mínimo.`);
      return;
    }

    const max = maxRedeemable();
    if (amount > max) {
      setError(`⚠️ Valor máximo que pode ser pago com cashback: ${formatCurrency(max)} (${settings?.max_cashback_payment_percentage}% da compra).`);
      return;
    }

    if (amount > (customer?.available_balance || 0)) {
      setError('⚠️ Saldo insuficiente.'); return;
    }

    setConfirmRedeem(true);
  };

  const handleRedeemConfirm = async () => {
    const codeDigits = (customer.identifier_code || '').replace(/\D/g, '');
    const typedDigits = (verifyCode || '').replace(/\D/g, '');
    if (!codeDigits) {
      setVerifyError('Este cliente não possui CPF cadastrado. Cadastre o CPF no perfil do cliente antes de prosseguir.');
      return;
    }
    if (!typedDigits || typedDigits !== codeDigits) {
      setVerifyError('CPF incorreto. Peça ao cliente o CPF cadastrado no app (Minha Área).');
      return;
    }
    setRedeeming(true);
    setError('');
    setVerifyError('');

    const amount = parseFloat(redeemAmount);
    const saleTotal = parseFloat(redeemSaleTotal);

    // Snapshot for rollback if the network calls fail
    const prevCustomer = customer;
    const prevTransactions = transactions;

    // Determine which transactions will be consumed (FIFO) for the optimistic update
    let previewRemaining = amount;
    const optimisticUpdates = [];
    for (const tx of availableTransactions) {
      if (previewRemaining <= 0) break;
      const avail = (Number(tx.amount) || 0) - (Number(tx.used_amount) || 0);
      if (avail <= 0) continue;
      const consume = Math.min(previewRemaining, avail);
      const newUsed = (Number(tx.used_amount) || 0) + consume;
      optimisticUpdates.push({ id: tx.id, consume, newUsed, fullyUsed: newUsed >= (Number(tx.amount) || 0) });
      previewRemaining -= consume;
    }

    // Optimistic UI update — reflect the redemption immediately, ahead of the network
    setCustomer(prev => ({
      ...prev,
      available_balance: Math.max(0, (prev.available_balance || 0) - amount),
      total_cashback_used: (prev.total_cashback_used || 0) + amount,
    }));
    setTransactions(prev => {
      const updateMap = new Map(optimisticUpdates.map(u => [u.id, u]));
      const marked = prev.map(t => {
        const u = updateMap.get(t.id);
        if (!u) return t;
        return { ...t, used_amount: u.newUsed, status: u.fullyUsed ? 'usado' : t.status };
      });
      const usageTxLocal = {
        id: `optimistic-${Date.now()}`,
        customer_id: customer.id,
        customer_name: customer.name,
        sale_number: redeemSaleNumber,
        amount: -amount,
        type: 'utilizado',
        status: 'usado',
        transaction_date: new Date().toISOString().split('T')[0],
        operator_id: user?.id || '',
        is_demo: false,
      };
      return [usageTxLocal, ...marked];
    });

    try {
      let remaining = amount;
      const usedTxIds = [];

      // Use oldest transactions first (FIFO), consuming partially via used_amount
      for (const tx of availableTransactions) {
        if (remaining <= 0) break;
        const avail = (Number(tx.amount) || 0) - (Number(tx.used_amount) || 0);
        if (avail <= 0) continue;
        const consume = Math.min(remaining, avail);
        const newUsed = (Number(tx.used_amount) || 0) + consume;
        const fullyUsed = newUsed >= (Number(tx.amount) || 0);
        await CashbackTransaction.update(tx.id, {
          used_amount: newUsed,
          ...(fullyUsed ? { status: 'usado' } : {}),
        });
        usedTxIds.push(tx.id);
        remaining -= consume;
      }

      // Create redemption usage transaction
      const usageTx = await CashbackTransaction.create({
        customer_id: customer.id,
        customer_name: customer.name,
        sale_number: redeemSaleNumber,
        amount: -amount,
        type: 'utilizado',
        status: 'usado',
        transaction_date: new Date().toISOString().split('T')[0],
        operator_id: user?.id || '',
        reference_transaction_id: usedTxIds[0] || '',
        is_demo: false,
      });

      // Create redemption record
      await CashbackRedemption.create({
        customer_id: customer.id,
        customer_name: customer.name,
        sale_number: redeemSaleNumber,
        amount_redeemed: amount,
        sale_total: saleTotal,
        redemption_date: new Date().toISOString().split('T')[0],
        operator_id: user?.id || '',
        status: 'ativo',
        transactions_used: usedTxIds,
        is_demo: false,
      });

      // Update customer balance
      const newBalance = (customer.available_balance || 0) - amount;
      await Customer.update(customer.id, {
        available_balance: Math.max(0, newBalance),
        total_cashback_used: (customer.total_cashback_used || 0) + amount,
      });

      await createAuditLog(user, 'redeem_cashback', 'CashbackRedemption', usageTx.id,
        `Cashback de ${formatCurrency(amount)} utilizado por ${customer.name} na venda #${redeemSaleNumber}`, '', null, { amount, saleTotal });

      setSuccess(`✅ ${formatCurrency(amount)} de cashback utilizado com sucesso!`);
      setRedeemMode(false);
      setConfirmRedeem(false);
      setRedeemAmount('');
      setRedeemSaleNumber('');
      setRedeemSaleTotal('');
      setVerifyCode('');
      setVerifyError('');

      // Notifica o cliente por e-mail sobre o valor resgatado (via função de backend)
      let emailSent = false;
      try {
        const newBalanceForEmail = Math.max(0, (customer.available_balance || 0) - amount);
        const res = await base44.functions.invoke('notify-redemption', {
          customer_id: customer.id,
          customer_name: customer.name,
          amount,
          sale_number: redeemSaleNumber,
          sale_total: saleTotal,
          new_balance: newBalanceForEmail,
          // Consumo por transação de origem (FIFO) — espelha na tabela cashback_whatsapp.
          consumed_transactions: optimisticUpdates.map(u => ({ cashback_id_origem: u.id, consumed: u.consume })),
        });
        emailSent = res?.data?.success === true;
      } catch (emailErr) {
        console.error('Email notification error:', emailErr);
      }
      const newBalanceFinal = Math.max(0, (customer.available_balance || 0) - amount);
      setRedeemResult({
        customerName: customer.name,
        saleNumber: redeemSaleNumber,
        saleTotal: saleTotal,
        amount,
        newBalance: newBalanceFinal,
        emailSent,
      });
      if (emailSent) {
        setSuccess(`✅ ${formatCurrency(amount)} de cashback utilizado com sucesso! E-mail enviado ao cliente.`);
      } else {
        setSuccess(`✅ ${formatCurrency(amount)} de cashback utilizado com sucesso! (Não foi possível enviar o e-mail — verifique se o cliente possui e-mail cadastrado.)`);
      }

      // Refresh customer
      const updated = await Customer.get(customer.id);
      setCustomer(updated);
      await selectCustomer(updated);
    } catch (e) {
      // Revert the optimistic update so the UI stays in sync with the server
      setCustomer(prevCustomer);
      setTransactions(prevTransactions);
      setError('Erro ao registrar utilização: ' + e.message);
    } finally {
      setRedeeming(false);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-gray-900">Consultar Cashback</h1>
        <p className="text-gray-500 text-sm">Consulte saldo e registre utilização de cashback</p>
      </div>

      {/* Search */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-4">
        <div className="relative mb-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => handleSearch(e.target.value)}
            placeholder="Buscar por nome, telefone, e-mail ou código..."
            className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm" />
        </div>
        {searchResults.length > 0 && (
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            {searchResults.map(c => (
              <button key={c.id} onClick={() => selectCustomer(c)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-orange-50 text-left border-b border-gray-100 last:border-0">
                <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center font-bold text-sm">{c.name?.charAt(0)}</div>
                <div className="flex-1">
                  <div className="font-semibold text-sm">{c.name}</div>
                  <div className="text-xs text-gray-400">{formatPhone(c.phone)}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-bold text-green-600">{formatCurrency(c.available_balance)}</div>
                  <div className="text-xs text-gray-400">disponível</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Customer balance panel */}
      {customer && (
        <>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Wallet className="w-4 h-4 text-green-600" />
                <span className="text-xs font-semibold text-green-700 uppercase tracking-wide">Disponível</span>
              </div>
              <div className="text-2xl font-black text-green-600">{formatCurrency(customer.available_balance)}</div>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-yellow-600" />
                <span className="text-xs font-semibold text-yellow-700 uppercase tracking-wide">Pendente</span>
              </div>
              <div className="text-2xl font-black text-yellow-600">{formatCurrency(customer.pending_balance)}</div>
            </div>
          </div>

          {settings && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4 text-xs text-blue-700">
              <strong>Regras:</strong> Compra mínima {formatCurrency(settings.min_purchase_to_use)} · Máx. {settings.max_cashback_payment_percentage}% da compra em cashback
            </div>
          )}

          {error && <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center gap-2"><AlertTriangle className="w-4 h-4" />{error}</div>}
          {success && <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm">{success}</div>}

          {/* Redeem cashback */}
          {!redeemMode ? (
            <button onClick={() => { setRedeemMode(true); setError(''); setSuccess(''); }}
              disabled={(customer.available_balance || 0) <= 0}
              className="w-full py-3.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-2xl mb-4 flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20">
              <ShoppingCart className="w-5 h-5" />
              {(customer.available_balance || 0) > 0 ? 'Usar Cashback' : 'Sem saldo disponível'}
            </button>
          ) : (
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-4">
              <h3 className="font-bold text-gray-900 mb-4">Registrar Utilização de Cashback</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Número da Venda *</label>
                  <input value={redeemSaleNumber} onChange={e => setRedeemSaleNumber(e.target.value)} placeholder="Ex: 001234"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm font-mono" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Valor Total da Compra (R$) *</label>
                  <input type="number" min="0" step="0.01" value={redeemSaleTotal} onChange={e => setRedeemSaleTotal(e.target.value)} placeholder="0,00"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Valor a Usar em Cashback (R$) *</label>
                  <input type="number" min="0" step="0.01" max={maxRedeemable()} value={redeemAmount} onChange={e => setRedeemAmount(e.target.value)} placeholder="0,00"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm" />
                  {redeemSaleTotal && <p className="text-xs text-gray-400 mt-1">Máx disponível para esta compra: {formatCurrency(maxRedeemable())}</p>}
                </div>
              </div>
              <div className="flex gap-3 mt-4">
                <button onClick={() => { setRedeemMode(false); setError(''); }} className="flex-1 py-3 border border-gray-200 rounded-xl text-sm font-semibold">Cancelar</button>
                <button onClick={handleRedeemSubmit} className="flex-1 py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-sm">Confirmar</button>
              </div>
            </div>
          )}

          {/* Confirm modal */}
          {confirmRedeem && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
                <h3 className="font-black text-lg mb-2">Confirmar utilização</h3>
                <p className="text-gray-500 text-sm mb-4">Confirme os dados e peça o CPF do cliente para verificação.</p>
                <div className="space-y-2 text-sm mb-4">
                  <div className="flex justify-between py-1.5 border-b border-gray-100">
                    <span className="text-gray-500">Cliente</span><span className="font-semibold">{customer.name}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-gray-100">
                    <span className="text-gray-500">Venda #</span><span className="font-mono font-bold">{redeemSaleNumber}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-gray-100">
                    <span className="text-gray-500">Valor da compra</span><span className="font-semibold">{formatCurrency(parseFloat(redeemSaleTotal))}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-gray-100">
                    <span className="text-gray-500">Cashback a usar</span><span className="font-black text-orange-600 text-lg">- {formatCurrency(parseFloat(redeemAmount))}</span>
                  </div>
                </div>
                <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 mb-4">
                  <label className="block text-xs font-semibold text-orange-700 mb-1.5 uppercase tracking-wide">CPF do Cliente *</label>
                  <input value={verifyCode} onChange={e => setVerifyCode(e.target.value)}
                    placeholder="Digite o CPF do cliente"
                    className="w-full px-4 py-3 border border-orange-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm font-mono tracking-wider" />
                  <p className="text-xs text-orange-600 mt-1">Peça ao cliente o CPF cadastrado no app (Minha Área).</p>
                  {verifyError && <p className="text-xs text-red-600 mt-1 font-semibold">⚠️ {verifyError}</p>}
                </div>
                <div className="flex gap-3">
                  <button onClick={() => { setConfirmRedeem(false); setVerifyError(''); }} className="flex-1 py-3 border border-gray-200 rounded-xl text-sm font-semibold">Voltar</button>
                  <button onClick={handleRedeemConfirm} disabled={redeeming}
                    className="flex-1 py-3 bg-orange-500 text-white font-bold rounded-xl text-sm disabled:opacity-60">
                    {redeeming ? 'Processando...' : 'Confirmar'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Transaction history */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <h3 className="font-bold text-gray-900 mb-4">Histórico de Cashback</h3>
            {loading ? (
              <div className="flex justify-center py-8"><div className="w-6 h-6 border-3 border-orange-200 border-t-orange-500 rounded-full animate-spin" /></div>
            ) : transactions.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm">Nenhuma movimentação encontrada</div>
            ) : (
              <div className="space-y-2">
                {transactions.slice(0, 10).map(tx => (
                  <div key={tx.id} className="flex items-center justify-between py-2 border-b border-gray-50">
                    <div>
                      <div className="text-sm font-semibold text-gray-900">{tx.sale_number ? `Venda #${tx.sale_number}` : tx.type}</div>
                      <div className="text-xs text-gray-400">{formatDate(tx.transaction_date)}</div>
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

          <RedemptionSuccessModal
            open={!!redeemResult}
            result={redeemResult}
            onClose={() => setRedeemResult(null)}
          />
        </>
      )}
    </div>
  );
}