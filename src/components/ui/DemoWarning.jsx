import React from 'react';
import { AlertTriangle } from 'lucide-react';

export default function DemoWarning() {
  return (
    <div className="bg-yellow-50 border border-yellow-300 rounded-xl p-3 flex items-center gap-2 text-yellow-800 text-sm font-medium mb-4">
      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
      <span>⚠️ Dados de demonstração — separados do ambiente real</span>
    </div>
  );
}