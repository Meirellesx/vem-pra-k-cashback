import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { createAuditLog } from '@/lib/cashbackUtils';
import { AlertTriangle, X, Check, Loader2 } from 'lucide-react';

export default function DeleteAccountModal({ customer, onClose }) {
  const { user, logout } = useAuth();
  const [confirmText, setConfirmText] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleDelete = async () => {
    setLoading(true);
    try {
      if (customer?.id) {
        await base44.entities.Customer.update(customer.id, {
          is_active: false,
          notes: 'Solicitação de exclusão de conta pelo cliente',
        });
      }
      await createAuditLog(
        user,
        'delete_account_request',
        'Customer',
        customer?.id || '',
        `Solicitação de exclusão de conta: ${customer?.name || user?.email}`,
        'Cliente solicitou exclusão',
        customer,
        { is_active: false }
      );
      setDone(true);
      setTimeout(() => { logout(); }, 2000);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
        {done ? (
          <div className="text-center py-4">
            <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Check className="w-7 h-7 text-green-600" />
            </div>
            <h3 className="font-bold text-lg mb-1">Solicitação registrada</h3>
            <p className="text-gray-500 text-sm">Sua conta foi desativada. Você será desconectado.</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>
                <h3 className="font-bold text-lg">Excluir minha conta</h3>
              </div>
              <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-gray-500 text-sm mb-4">
              Esta ação desativa sua conta e seus dados de cliente. Seu saldo de cashback não poderá mais ser utilizado. Para reativar, entre em contato com a loja.
            </p>
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
              <p className="text-xs text-red-700 mb-2">Para confirmar, digite <strong>EXCLUIR</strong> abaixo:</p>
              <input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="EXCLUIR"
                className="w-full px-3 py-2 border border-red-200 rounded-lg text-sm font-bold uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 py-3 border border-gray-200 rounded-xl text-sm font-semibold">Cancelar</button>
              <button
                onClick={handleDelete}
                disabled={loading || confirmText !== 'EXCLUIR'}
                className="flex-1 py-3 bg-red-500 text-white font-bold rounded-xl text-sm disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Excluir conta'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}