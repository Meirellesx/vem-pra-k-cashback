import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { formatCpf } from '@/lib/cashbackUtils';

export default function MeuCodigo() {
  const { user } = useAuth();
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        if (!user?.id) return;
        const all = await base44.entities.Customer.list('-created_date', 500);
        const mine = all.find(
          (c) =>
            (c.email && user.email && c.email.toLowerCase() === user.email.toLowerCase()) ||
            c.created_by_id === user.id
        );
        if (mine) setCustomer(mine);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  if (loading)
    return (
      <div className="flex items-center justify-center h-40">
        <div className="w-8 h-8 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
      </div>
    );

  if (!customer)
    return (
      <div className="p-4 md:p-8 max-w-md mx-auto text-center">
        <p className="text-gray-500 text-sm">Complete seu cadastro em Minha Área para gerar seu código.</p>
      </div>
    );

  return (
    <div className="p-4 md:p-8 max-w-md mx-auto">
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 text-center">
        <div className="w-40 h-40 bg-[#0A0A0A] mx-auto rounded-2xl flex flex-col items-center justify-center mb-3 p-4">
          <div className="grid grid-cols-3 gap-1 w-full mb-2">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className={`h-4 rounded-sm ${[0, 2, 6, 8, 4].includes(i) ? 'bg-orange-500' : 'bg-[#ffffff]'}`} />
            ))}
          </div>
          <div className="text-white font-mono text-xs font-bold mt-1">{formatCpf(customer.identifier_code)}</div>
        </div>
        <p className="text-sm text-gray-500 mb-2">Apresente seu CPF no caixa</p>
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-3">
          <span className="font-mono font-black text-orange-600 text-xl tracking-widest">{formatCpf(customer.identifier_code)}</span>
        </div>
      </div>
    </div>
  );
}