'use client';

import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';

type ComboboxItem = {
  id: string;
  label: string;
  searchText?: string;
};

type ComboboxProps = {
  label?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  items: ComboboxItem[];
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
};

export function Combobox({
  label,
  searchPlaceholder = 'Search...',
  emptyText = 'No results',
  items,
  value,
  onChange,
  disabled = false,
}: ComboboxProps) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => `${i.label} ${i.searchText || ''}`.toLowerCase().includes(q));
  }, [items, query]);

  return (
    <div className="space-y-1">
      {label ? <div className="text-sm font-medium">{label}</div> : null}
      <Input
        placeholder={searchPlaceholder}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        disabled={disabled}
      />
      <div className="max-h-40 overflow-auto rounded-md border border-slate-200 bg-white">
        {filtered.length === 0 ? (
          <div className="px-3 py-2 text-sm text-muted-foreground">{emptyText}</div>
        ) : (
          filtered.map((item) => (
            <button
              key={item.id}
              type="button"
              disabled={disabled}
              className={`w-full px-3 py-2 text-left text-sm hover:bg-slate-50 ${
                value === item.id ? 'bg-indigo-50 text-indigo-700' : ''
              }`}
              onClick={() => onChange(item.id)}
            >
              {item.label}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
