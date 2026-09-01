import React from 'react';
import { CheckCircle, X } from 'lucide-react';

// Tela de sucesso reutilizável para ações do dashboard.
// Mostra uma confirmação visual clara de que a ação foi concluída,
// evitando que o operador repita a ação achando que não ocorreu.
//
// Props:
// - open: boolean
// - title: string (ex: "Cliente Cadastrado!")
// - subtitle: string (ex: "O cliente foi criado com sucesso.")
// - details: array de { label, value, mono } exibidos em linhas
// - confirmLabel: texto do botão principal (default "Concluir")
// - onConfirm: callback do botão principal
// - onSecondary: callback opcional do botão secundário (omitir para esconder)
// - secondaryLabel: texto do botão secundário
export default function SuccessModal({
  open,
  title,
  subtitle,
  details = [],
  confirmLabel = 'Concluir',
  onConfirm,
  onSecondary,
  secondaryLabel,
}) {
  if (!open) return null;

  const renderDetails = details.length > 0 && (
    <div className="space-y-1 mb-6 bg-gray-50 rounded-xl p-4 border border-gray-100">
      {details.map((d, i) => (
        <div key={i} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0 gap-3">
          <span className="text-gray-500 text-sm flex-shrink-0">{d.label}</span>
          <span className={`text-right text-sm font-semibold ${d.mono ? 'font-mono text-xs' : ''}`} data-selectable>
            {d.value || '—'}
          </span>
        </div>
      ))}
    </div>
  );

  const secondaryButton = onSecondary && (
    <button
      onClick={onSecondary}
      className="flex-1 py-3 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-all"
    >
      {secondaryLabel || 'Nova ação'}
    </button>
  );

  const primaryButton = (
    <button
      onClick={onConfirm}
      className="flex-1 py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-sm shadow-lg shadow-orange-500/30 transition-all"
    >
      {confirmLabel}
    </button>
  );

  const actions = onSecondary
    ? (
      <div className="flex gap-3">
        {secondaryButton}
        {primaryButton}
      </div>
    )
    : (
      <div>
        {primaryButton}
      </div>
    );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 relative">
        <button
          onClick={onConfirm}
          className="absolute top-4 right-4 p-1 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600"
          aria-label="Fechar"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-9 h-9 text-green-600" />
          </div>
          <h2 className="text-xl font-black text-gray-900 mb-1">{title}</h2>
          {subtitle && <p className="text-gray-500 text-sm mb-5">{subtitle}</p>}
        </div>

        {renderDetails}
        {actions}
      </div>
    </div>
  );
}