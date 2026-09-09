import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import Customer from '@/lib/customersDb';
import { useAuth } from '@/lib/AuthContext';
import { formatCurrency, formatPhone, cpfToIdentifierCode, createAuditLog, exportToCSV } from '@/lib/cashbackUtils';
import { Search, Plus, Download, User, Phone, Wallet, Clock, Edit2, X, Check, AlertTriangle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import SuccessModal from '@/components/SuccessModal';
import { validateCustomerForm } from '@/lib/validators';

// Normaliza para comparar: remove tudo que não é dígito/letra e caixa baixa.
const norm = (v) => String(v || '').toLowerCase().replace(/[^0-9a-z]/g, '');

// Busca clientes potencialmente duplicados por CPF, telefone ou e-mail.
// Consulta server-side (varre a base toda), não só o que está carregado na tela.
async function findDuplicateCustomers(form) {
  const cpfN = norm(form.cpf);
  const phoneN = norm(form.phone);
  const emailN = norm(form.email);
  const terms = [];
  if (cpfN.length >= 11) terms.push(form.cpf);
  if (phoneN.length >= 10) terms.push(form.phone);
  if (emailN) terms.push(form.email);
  const byId = {};
  for (const t of terms) {
    const rows = await Customer.search(t, { extraFilters: { is_demo: false }, limit: 20 }).catch(() => []);
    for (const c of (rows || [])) byId[c.id] = c;
  }
  return Object.values(byId)
    .filter(c => c.is_active !== false)
    .filter(c => {
      if (cpfN && norm(c.cpf) === cpfN && cpfN.length >= 11) return true;
      if (phoneN && norm(c.phone) === phoneN && phoneN.length >= 10) return true;
      if (emailN && c.email && norm(c.email) === emailN) return true;
      return false;
    });
}

function CustomerModal({ customer, onClose, onSave }) {
  const [form, setForm] = useState(customer || { name: '', phone: '', email: '', cpf: '', accepts_promotions: false, cashback_comunicacao_opt_in: false });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const handleSave = async () => {
    const errs = validateCustomerForm(form, { requireEmail: false });
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    try {
      await onSave(form);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-bold text-lg">{customer ? 'Editar Cliente' : 'Novo Cliente'}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Nome *</label>
            <input value={form.name} onChange={e => setForm({...form, name: e.target.value})}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm" />
            {errors.name && <p className="text-xs text-red-600 mt-1">{errors.name}</p>}
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Telefone *</label>
            <input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})}
              placeholder="(00) 00000-0000"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm" />
            {errors.phone && <p className="text-xs text-red-600 mt-1">{errors.phone}</p>}
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">E-mail <span className="text-gray-400 font-normal">(opcional)</span></label>
            <input type="email" value={form.email || ''} onChange={e => setForm({...form, email: e.target.value})}
              placeholder="email@exemplo.com"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm" />
            {errors.email && <p className="text-xs text-red-600 mt-1">{errors.email}</p>}
            {!customer && (
              <p className="text-xs text-gray-400 mt-1">Se informado, o cliente recebe um e-mail para criar a senha e acessar a plataforma.</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">CPF *</label>
            <input value={form.cpf || ''} onChange={e => setForm({...form, cpf: e.target.value})}
              placeholder="000.000.000-00"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm" />
            {errors.cpf && <p className="text-xs text-red-600 mt-1">{errors.cpf}</p>}
            {!customer && (
              <p className="text-xs text-orange-600 mt-1">O CPF é o código de identificação do cliente para resgate de cashback.</p>
            )}
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.accepts_promotions || false} onChange={e => setForm({...form, accepts_promotions: e.target.checked})}
              className="w-4 h-4 accent-orange-500" />
            <span className="text-sm text-gray-700">Aceita comunicações promocionais</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.cashback_comunicacao_opt_in || false} onChange={e => setForm({...form, cashback_comunicacao_opt_in: e.target.checked})}
              className="w-4 h-4 accent-orange-500" />
            <span className="text-sm text-gray-700">Aceita receber atualizações sobre seu cashback pelo WhatsApp</span>
          </label>
          <p className="text-xs text-gray-400">Os dois aceites são independentes: promoções (ofertas e campanhas) e mensagens de cashback (saldo, vencimento e uso).</p>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50">Cancelar</button>
          <button onClick={handleSave} disabled={saving || !form.name || !form.phone || !form.cpf}
            className="flex-1 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white rounded-xl text-sm font-bold">
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Customers() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [customers, setCustomers] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [editCustomer, setEditCustomer] = useState(null);
  const [duplicateMatches, setDuplicateMatches] = useState(null);
  const [pendingForm, setPendingForm] = useState(null);
  const [duplicateChecking, setDuplicateChecking] = useState(false);
  const [createdCustomer, setCreatedCustomer] = useState(null);

  useEffect(() => { loadCustomers(); }, []);

  // Carga inicial: contagem real (server-side) + os 100 mais recentes p/ exibir.
  const loadCustomers = async () => {
    setLoading(true);
    const [data, total] = await Promise.all([
      Customer.list('-created_date', 100),
      Customer.count({ is_demo: false }),
    ]);
    setCustomers((data || []).filter(c => c.is_active !== false));
    setTotalCount(total || 0);
    setLoading(false);
  };

  // Busca digitada vai para o servidor (varre a base toda, não só os 100 mais
  // recentes). Ao limpar o campo, recarrega a lista padrão.
  useEffect(() => {
    const term = search.trim();
    if (term.length < 2) {
      if (!loading) loadCustomers();
      return;
    }
    const h = setTimeout(async () => {
      try {
        const rows = await Customer.search(term, { extraFilters: { is_demo: false }, limit: 50 });
        setCustomers((rows || []).filter(c => c.is_active !== false));
      } catch (e) { console.error(e); }
    }, 300);
    return () => clearTimeout(h);
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  const isSearching = search.trim().length >= 2;
  const filtered = customers.filter(c => !c.is_demo && c.is_active !== false);

  // Cria o cliente de fato e exibe a tela de sucesso com os dados criados.
  const doCreateCustomer = async (form) => {
    try {
      const code = cpfToIdentifierCode(form.cpf);
      const created = await Customer.create({
        ...form, identifier_code: code, available_balance: 0, pending_balance: 0,
        total_cashback_earned: 0, total_cashback_used: 0, is_demo: false,
      });
      await createAuditLog(user, 'create_customer', 'Customer', created.id, `Novo cliente cadastrado: ${form.name}`, '', null, form);
      let inviteSent = false;
      if (form.email) {
        try {
          await base44.functions.invoke('invite-customer', { email: form.email, name: form.name });
          inviteSent = true;
        } catch (inviteErr) {
          console.error('Invite error:', inviteErr);
        }
      }
      // Fecha o formulário e mostra a confirmação visual de sucesso.
      setModal(null);
      setEditCustomer(null);
      setDuplicateMatches(null);
      setPendingForm(null);
      setCreatedCustomer({ ...created, _inviteSent: inviteSent });
      loadCustomers();
    } catch (e) {
      console.error(e);
      toast({ title: 'Erro ao cadastrar', description: e.message || 'Não foi possível cadastrar o cliente.', variant: 'destructive' });
    }
  };

  const handleSave = async (form) => {
    try {
      if (editCustomer) {
        const code = cpfToIdentifierCode(form.cpf);
        await Customer.update(editCustomer.id, { ...form, identifier_code: code });
        await createAuditLog(user, 'update_customer', 'Customer', editCustomer.id, `Cliente atualizado: ${form.name}`, '', editCustomer, { ...form, identifier_code: code });
        if (form.email && form.email !== editCustomer.email) {
          try {
            await base44.functions.invoke('invite-customer', { email: form.email, name: form.name });
            toast({ title: 'Convite enviado', description: `Convite enviado para ${form.email}.` });
          } catch (inviteErr) {
            console.error('Invite error:', inviteErr);
          }
        }
        setModal(null);
        setEditCustomer(null);
        loadCustomers();
      } else {
        // NOVO cliente: checa duplicidade (CPF/telefone/e-mail) antes de criar.
        setDuplicateChecking(true);
        const matches = await findDuplicateCustomers(form);
        setDuplicateChecking(false);
        if (matches.length > 0) {
          // Possível duplicata — pede confirmação explícita antes de cadastrar.
          setDuplicateMatches(matches);
          setPendingForm(form);
        } else {
          await doCreateCustomer(form);
        }
      }
    } catch (e) {
      console.error(e);
      setDuplicateChecking(false);
    }
  };

  const closeSuccess = () => setCreatedCustomer(null);
  const startAnother = () => { setCreatedCustomer(null); setEditCustomer(null); setModal('new'); };

  const handleExport = async () => {
    const all = await Customer.list('-created_date', 10000);
    const rows = (all || []).filter(c => !c.is_demo && c.is_active !== false);
    exportToCSV(rows, 'clientes.csv', [
      { key: 'name', label: 'Nome' },
      { key: 'phone', label: 'Telefone' },
      { key: 'email', label: 'E-mail' },
      { key: 'cpf', label: 'CPF' },
      { key: 'available_balance', label: 'Saldo Disponível' },
      { key: 'pending_balance', label: 'Saldo Pendente' },
      { key: 'total_cashback_earned', label: 'Total Gerado' },
      { key: 'total_cashback_used', label: 'Total Utilizado' },
      { key: 'identifier_code', label: 'Código' },
    ]);
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Clientes</h1>
          <p className="text-gray-500 text-sm">
            {isSearching ? `${filtered.length} resultado(s)` : `${totalCount} clientes`}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50">
            <Download className="w-4 h-4" /> Exportar CSV
          </button>
          <button onClick={() => { setEditCustomer(null); setModal('new'); }}
            className="flex items-center gap-2 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-orange-500/20">
            <Plus className="w-4 h-4" /> Novo Cliente
          </button>
        </div>
      </div>

      <div className="relative mb-5">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nome ou telefone..."
          className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm bg-white"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-8 h-8 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {filtered.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <User className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-semibold">Nenhum cliente encontrado</p>
              <p className="text-sm mt-1">Tente outro termo de busca ou cadastre um novo cliente</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left text-gray-500 font-semibold px-4 py-3">Cliente</th>
                    <th className="text-left text-gray-500 font-semibold px-4 py-3 hidden sm:table-cell">Telefone</th>
                    <th className="text-right text-gray-500 font-semibold px-4 py-3">Disponível</th>
                    <th className="text-right text-gray-500 font-semibold px-4 py-3 hidden md:table-cell">Pendente</th>
                    <th className="text-left text-gray-500 font-semibold px-4 py-3 hidden lg:table-cell">Código</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(c => (
                    <tr key={c.id} className="border-t border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-bold text-sm flex-shrink-0">
                            {c.name?.charAt(0)?.toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-gray-900">{c.name}</div>
                            <div className="text-gray-400 text-xs sm:hidden">{formatPhone(c.phone)}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">{formatPhone(c.phone)}</td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-bold text-green-600">{formatCurrency(c.available_balance)}</span>
                      </td>
                      <td className="px-4 py-3 text-right hidden md:table-cell">
                        <span className="font-semibold text-yellow-600">{formatCurrency(c.pending_balance)}</span>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded-lg">{c.identifier_code}</span>
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => { setEditCustomer(c); setModal('edit'); }}
                          className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600">
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {modal && (
        <CustomerModal
          customer={modal === 'edit' ? editCustomer : null}
          onClose={() => { setModal(null); setEditCustomer(null); }}
          onSave={handleSave}
        />
      )}

      {/* Aviso de possível cliente duplicado — evita cadastro repetido. */}
      {duplicateMatches && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="w-12 h-12 rounded-full bg-yellow-100 flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6 text-yellow-600" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Cliente possivelmente já cadastrado</h3>
            <p className="text-gray-600 text-sm mb-4 leading-relaxed">
              Encontramos {duplicateMatches.length === 1 ? 'um cliente' : `${duplicateMatches.length} clientes`} com os mesmos dados (CPF, telefone ou e-mail). Confira abaixo antes de cadastrar novamente.
            </p>
            <div className="space-y-2 mb-5 max-h-48 overflow-y-auto">
              {duplicateMatches.map(m => (
                <div key={m.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                  <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-bold text-sm flex-shrink-0">
                    {m.name?.charAt(0)?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm text-gray-900 truncate">{m.name}</div>
                    <div className="text-xs text-gray-500">{formatPhone(m.phone)}{m.email ? ` · ${m.email}` : ''}</div>
                  </div>
                  <button onClick={() => { setDuplicateMatches(null); setModal(null); setEditCustomer(null); }}
                    className="text-xs font-semibold text-orange-600 hover:text-orange-700 px-2 py-1 rounded-lg hover:bg-orange-50">
                    Ver
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setDuplicateMatches(null); setPendingForm(null); }}
                className="flex-1 py-3 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50">
                Cancelar
              </button>
              <button onClick={() => { const f = pendingForm; setDuplicateMatches(null); setPendingForm(null); doCreateCustomer(f); }}
                className="flex-1 py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-sm">
                Cadastrar mesmo assim
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmação visual de cliente criado — evita cadastro duplicado. */}
      <SuccessModal
        open={!!createdCustomer}
        title="Cliente Cadastrado!"
        subtitle="O cliente foi criado com sucesso no programa de cashback."
        details={createdCustomer ? [
          { label: 'Nome', value: createdCustomer.name },
          { label: 'Telefone', value: formatPhone(createdCustomer.phone) },
          { label: 'E-mail', value: createdCustomer.email || '—' },
          { label: 'CPF', value: createdCustomer.cpf || '—' },
          { label: 'Código de cashback', value: createdCustomer.identifier_code, mono: true },
          { label: 'Convite', value: createdCustomer._inviteSent ? 'Enviado por e-mail ✅' : 'Não enviado' },
        ] : []}
        confirmLabel="Concluir"
        secondaryLabel="Cadastrar outro"
        onConfirm={closeSuccess}
        onSecondary={startAnother}
      />
    </div>
  );
}