import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import Customer from '@/lib/customersDb';
import { useAuth } from '@/lib/AuthContext';
import { formatCurrency, formatPhone, cpfToIdentifierCode, createAuditLog, exportToCSV } from '@/lib/cashbackUtils';
import { Search, Plus, Download, User, Phone, Wallet, Clock, Edit2, X, Check } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

function CustomerModal({ customer, onClose, onSave }) {
  const [form, setForm] = useState(customer || { name: '', phone: '', email: '', cpf: '', accepts_promotions: false });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.name || !form.phone || !form.cpf) return;
    if (!customer && !form.email) return;
    setSaving(true);
    onSave(form);
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
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Telefone *</label>
            <input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})}
              placeholder="(00) 00000-0000"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              E-mail {!customer && <span className="text-orange-500">*</span>}
            </label>
            <input type="email" value={form.email || ''} onChange={e => setForm({...form, email: e.target.value})}
              placeholder="email@exemplo.com"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm" />
            {!customer && (
              <p className="text-xs text-orange-600 mt-1">O cliente receberá um e-mail para criar sua senha e acessar a plataforma.</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">CPF *</label>
            <input value={form.cpf || ''} onChange={e => setForm({...form, cpf: e.target.value})}
              placeholder="000.000.000-00"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm" />
            {!customer && (
              <p className="text-xs text-orange-600 mt-1">O CPF é o código de identificação do cliente para resgate de cashback.</p>
            )}
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.accepts_promotions || false} onChange={e => setForm({...form, accepts_promotions: e.target.checked})}
              className="w-4 h-4 accent-orange-500" />
            <span className="text-sm text-gray-700">Aceita comunicações promocionais</span>
          </label>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50">Cancelar</button>
          <button onClick={handleSave} disabled={saving || !form.name || !form.phone || !form.cpf || (!customer && !form.email)}
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
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [editCustomer, setEditCustomer] = useState(null);

  useEffect(() => { loadCustomers(); }, []);

  const loadCustomers = async () => {
    setLoading(true);
    const data = await Customer.list('-created_date', 200);
    setCustomers(data.filter(c => c.is_active !== false));
    setLoading(false);
  };

  const filtered = customers.filter(c =>
    !c.is_demo &&
    (c.name?.toLowerCase().includes(search.toLowerCase()) ||
     c.phone?.includes(search.replace(/\D/g, '')))
  );

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
      } else {
        const code = cpfToIdentifierCode(form.cpf);
        await Customer.create({ ...form, identifier_code: code, available_balance: 0, pending_balance: 0, total_cashback_earned: 0, total_cashback_used: 0, is_demo: false });
        await createAuditLog(user, 'create_customer', 'Customer', '', `Novo cliente cadastrado: ${form.name}`, '', null, form);
        if (form.email) {
          try {
            await base44.functions.invoke('invite-customer', { email: form.email, name: form.name });
            toast({ title: 'Cliente cadastrado', description: `Convite enviado para ${form.email}.` });
          } catch (inviteErr) {
            console.error('Invite error:', inviteErr);
            toast({ title: 'Cliente cadastrado', description: 'E-mail pode já estar cadastrado — o cliente não receberá novo convite.', variant: 'destructive' });
          }
        } else {
          toast({ title: 'Cliente cadastrado', description: 'Sem e-mail informado — convite não enviado.' });
        }
      }
      setModal(null);
      setEditCustomer(null);
      loadCustomers();
    } catch (e) {
      console.error(e);
    }
  };

  const handleExport = () => {
    exportToCSV(filtered, 'clientes.csv', [
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
          <p className="text-gray-500 text-sm">{filtered.length} clientes</p>
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
    </div>
  );
}