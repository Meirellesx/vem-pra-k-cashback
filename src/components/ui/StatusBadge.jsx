import React from 'react';
import { CASHBACK_STATUS } from '@/lib/constants';

export default function StatusBadge({ status, size = 'sm' }) {
  const config = CASHBACK_STATUS[status] || { label: status, color: 'bg-gray-100 text-gray-600 border border-gray-300' };
  const sizeClass = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-3 py-1';
  return (
    <span className={`inline-flex items-center rounded-full font-medium ${config.color} ${sizeClass}`}>
      {config.label}
    </span>
  );
}