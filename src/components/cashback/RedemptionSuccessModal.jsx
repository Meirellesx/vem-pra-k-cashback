import React from 'react';
import { CheckCircle, X, Mail, MailWarning } from 'lucide-react';
import { formatCurrency } from '@/lib/cashbackUtils';

// Tela de confirmação exibida após um resgate de cashback ser concluído com sucesso.
// Mostra o resumo da operação (cliente, venda, valores, novo saldo) e o status do
// e-mail enviado ao cliente. Não executa lógica — apenas apresenta o resultado.
export default function RedemptionSuccessModal({ open, result, onClose }) {
  if (!open || !result) return null;
  const { customerName, saleNumber, saleTotal, amount, newBalance, emailSent } = result;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl overflow-hidden">
        {/* Cabeçalho de sucesso */}
        <div className="brand-gradient px-6 py-8 text-center text-white relative">
          <button onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center"
            aria-label="Fechar">
            <X className="w-4 h-4" />
          </button>
          <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-3">
            <CheckCircle className="w-9 h-9" />
          </div>
          <h3 className="text-xl font-black">Resgate Concluído!</h3>
          <p className="text-white/90 text-sm mt-1">{formatCurrency(amount)} de cashback utilizado</p>
        </div>

        {/* Resumo da operação */}
        <div className="p-6">
          <div className="space-y-2 text-sm mb-5">
            <div className="flex justify-between py-1.5 border-b border-gray-100">
              <span className="text-gray-500">Cliente</span>
              <span className="font-semibold text-right">{customerName}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-gray-100">
              <span className="text-gray-500">Venda</span>
              <span className="font-mono font-bold">#{saleNumber}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-gray-100">
              <span className="text-gray-500">Valor da compra</span>
              <span className="font-semibold">{formatCurrency(saleTotal)}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-gray-100">
              <span className="text-gray-500">Cashback usado</span>
              <span className="font-black text-orange-600">- {formatCurrency(amount)}</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-gray-500">Novo saldo disponível</span>
              <span className="font-black text-green-600">{formatCurrency(newBalance)}</span>
            </div>
          </div>

          {/* Status do e-mail ao cliente */}
          <div className={`flex items-start gap-2 rounded-xl p-3 text-xs mb-5 ${
            emailSent ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-yellow-50 border border-yellow-200 text-yellow-700'
          }`}>
            {emailSent ? <Mail className="w-4 h-4 mt-0.5 flex-shrink-0" /> : <MailWarning className="w-4 h-4 mt-0.5 flex-shrink-0" />}
            <span>
              {emailSent
                ? 'E-mail de confirmação enviado ao cliente.'
                : 'Não foi possível enviar o e-mail — verifique se o cliente possui e-mail cadastrado.'}
            </span>
          </div>

          <button onClick={onClose}
            className="w-full py-3.5 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-2xl text-sm">
            Concluir
          </button>
        </div>
      </div>
    </div>
  );
}