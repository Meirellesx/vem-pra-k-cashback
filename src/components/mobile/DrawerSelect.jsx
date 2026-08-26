import React, { useState } from 'react';
import { Drawer, DrawerTrigger, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { useIsMobile } from '@/hooks/use-mobile';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function DrawerSelect({ value, onChange, options, placeholder = 'Selecione', label = 'Selecione', className = '' }) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  if (!isMobile) {
    return (
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn('px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 text-xs bg-white', className)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    );
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <button
          type="button"
          className={cn('flex items-center justify-between gap-2 px-3 py-2 border border-gray-200 rounded-xl text-xs bg-white min-w-[140px]', className)}
        >
          <span className={selected ? 'text-gray-900 font-medium' : 'text-gray-400'}>
            {selected ? selected.label : placeholder}
          </span>
          <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
        </button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{label}</DrawerTitle>
        </DrawerHeader>
        <div className="px-4 pb-8 max-h-[55vh] overflow-y-auto divide-y divide-gray-100">
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => { onChange(o.value); setOpen(false); }}
              className="w-full flex items-center justify-between py-3.5 text-left active:bg-gray-50"
            >
              <span className={`text-sm ${o.value === value ? 'font-bold text-orange-600' : 'text-gray-700'}`}>
                {o.label}
              </span>
              {o.value === value && <Check className="w-5 h-5 text-orange-500" />}
            </button>
          ))}
        </div>
      </DrawerContent>
    </Drawer>
  );
}