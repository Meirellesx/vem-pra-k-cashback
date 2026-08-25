import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { createAuditLog } from '@/lib/cashbackUtils';
import { Plus, X, Check, Package, Edit2 } from 'lucide-react';

const DEFAULT_CATEGORIES = [
  { name: 'Doces e Confeitaria', generates_cashback: true, can_use_cashback: true },
  { name: 'Mercearia', generates_cashback: true, can_use_cashback: true },
  { name: 'Utilidades Domésticas', generates_cashback: true, can_use_cashback: true },
  { name: 'Eletroeletrônicos', generates_cashback: true, can_use_cashback: true },
  { name: 'Atacado', generates_cashback: true, can_use_cashback: true },
];

function CategoryModal({ category, onClose, onSave }) {
  const [form, setForm] = useState(category || { name: '', generates_cashback: true, can_use_cashback: true, cashback_percentage_override: '', description: '' });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-bold text-lg">{category ? 'Editar Categoria' : 'Nova Categoria'}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Nome *</label>
            <input value={form.name} onChange={e => setForm({...form, name: e.target.value})}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Percentual específico (%)</label>
            <input type="number" min="0" max="100" step="0.1" value={form.cashback_percentage_override || ''}
              onChange={e => setForm({...form, cashback_percentage_override: e.target.value ? parseFloat(e.target.value) : null})}
              placeholder="Deixe em branco para usar o padrão"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm" />
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={form.generates_cashback !== false} onChange={e => setForm({...form, generates_cashback: e.target.checked})} className="w-4 h-4 accent-orange-500" />
            <span className="text-sm text-gray-700">Gera cashback</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={form.can_use_cashback !== false} onChange={e => setForm({...form, can_use_cashback: e.target.checked})} className="w-4 h-4 accent-orange-500" />
            <span className="text-sm text-gray-700">Permite uso de cashback</span>
          </label>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600">Cancelar</button>
          <button onClick={() => onSave(form)} disabled={!form.name}
            className="flex-1 py-2.5 bg-orange-500 text-white rounded-xl text-sm font-bold disabled:opacity-60">Salvar</button>
        </div>
      </div>
    </div>
  );
}

export default function Categories() {
  const { user } = useAuth();
  const [categories, setCategories] = useState([]);
  const [modal, setModal] = useState(null);
  const [editCat, setEditCat] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadCategories(); }, []);

  const loadCategories = async () => {
    setLoading(true);
    const data = await base44.entities.ProductCategory.list('-created_date');
    setCategories(data);
    setLoading(false);
  };

  const seedDefaults = async () => {
    for (const cat of DEFAULT_CATEGORIES) {
      await base44.entities.ProductCategory.create({ ...cat, is_active: true });
    }
    loadCategories();
  };

  const handleSave = async (form) => {
    if (editCat) {
      await base44.entities.ProductCategory.update(editCat.id, form);
      await createAuditLog(user, 'update_category', 'ProductCategory', editCat.id, `Categoria atualizada: ${form.name}`, '', editCat, form);
    } else {
      await base44.entities.ProductCategory.create({ ...form, is_active: true });
      await createAuditLog(user, 'create_category', 'ProductCategory', '', `Nova categoria: ${form.name}`, '', null, form);
    }
    setModal(null); setEditCat(null);
    loadCategories();
  };

  const toggleActive = async (cat) => {
    await base44.entities.ProductCategory.update(cat.id, { is_active: !cat.is_active });
    loadCategories();
  };

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Categorias de Produtos</h1>
          <p className="text-gray-500 text-sm">Configure quais categorias geram ou permitem uso de cashback</p>
        </div>
        <button onClick={() => { setEditCat(null); setModal('new'); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-orange-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-orange-500/20">
          <Plus className="w-4 h-4" /> Nova Categoria
        </button>
      </div>

      {categories.length === 0 && !loading && (
        <div className="bg-white rounded-2xl p-8 text-center shadow-sm border border-gray-100">
          <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="font-semibold text-gray-700 mb-2">Nenhuma categoria cadastrada</p>
          <button onClick={seedDefaults} className="px-6 py-2.5 bg-orange-500 text-white rounded-xl text-sm font-bold">
            Criar categorias padrão
          </button>
        </div>
      )}

      <div className="space-y-3">
        {categories.map(cat => (
          <div key={cat.id} className={`bg-white rounded-2xl p-4 shadow-sm border flex items-center gap-4 ${cat.is_active ? 'border-gray-100' : 'border-gray-200 opacity-60'}`}>
            <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center flex-shrink-0">
              <Package className="w-5 h-5 text-orange-600" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-gray-900 text-sm">{cat.name}</span>
                {!cat.is_active && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Inativa</span>}
              </div>
              <div className="flex gap-3 mt-1">
                <span className={`text-xs ${cat.generates_cashback !== false ? 'text-green-600' : 'text-gray-400'}`}>
                  {cat.generates_cashback !== false ? '✓ Gera cashback' : '✗ Não gera'}
                  {cat.cashback_percentage_override ? ` (${cat.cashback_percentage_override}%)` : ''}
                </span>
                <span className={`text-xs ${cat.can_use_cashback !== false ? 'text-blue-600' : 'text-gray-400'}`}>
                  {cat.can_use_cashback !== false ? '✓ Permite uso' : '✗ Não permite uso'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => toggleActive(cat)}
                className={`text-xs px-3 py-1 rounded-full font-semibold ${cat.is_active ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                {cat.is_active ? 'Desativar' : 'Ativar'}
              </button>
              <button onClick={() => { setEditCat(cat); setModal('edit'); }} className="p-1.5 hover:bg-gray-100 rounded-lg">
                <Edit2 className="w-4 h-4 text-gray-400" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {modal && <CategoryModal category={modal === 'edit' ? editCat : null} onClose={() => { setModal(null); setEditCat(null); }} onSave={handleSave} />}
    </div>
  );
}