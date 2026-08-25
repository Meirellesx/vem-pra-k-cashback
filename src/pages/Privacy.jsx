import React from 'react';
import { Shield } from 'lucide-react';

export default function Privacy() {
  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
          <Shield className="w-7 h-7 text-blue-600" />
        </div>
        <h1 className="text-2xl font-black text-gray-900">Política de Privacidade</h1>
        <p className="text-gray-500 text-sm">Vem Pra K Cashback</p>
      </div>
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 prose prose-sm max-w-none text-gray-700 space-y-4">
        <p className="text-xs text-gray-400">Última atualização: Janeiro de 2024</p>
        <h2 className="font-bold text-gray-900">1. Dados coletados</h2>
        <p>Coletamos nome, telefone, e-mail (opcional) e histórico de compras para operação do programa de cashback.</p>
        <h2 className="font-bold text-gray-900">2. Uso dos dados</h2>
        <p>Os dados são utilizados exclusivamente para: operação do programa de cashback, comunicações sobre seu saldo e, mediante consentimento, envio de comunicações promocionais.</p>
        <h2 className="font-bold text-gray-900">3. Compartilhamento</h2>
        <p>Não compartilhamos seus dados com terceiros, exceto quando exigido por lei.</p>
        <h2 className="font-bold text-gray-900">4. Seus direitos</h2>
        <p>Você pode solicitar acesso, correção ou exclusão dos seus dados a qualquer momento, junto ao estabelecimento.</p>
        <h2 className="font-bold text-gray-900">5. Retenção</h2>
        <p>Os dados são mantidos enquanto a conta estiver ativa e pelo período mínimo exigido pela legislação fiscal aplicável.</p>
        <h2 className="font-bold text-gray-900">6. Contato</h2>
        <p>Para exercer seus direitos ou tirar dúvidas, entre em contato diretamente com a Vem Pra K.</p>
      </div>
    </div>
  );
}