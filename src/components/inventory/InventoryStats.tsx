import React, { useMemo } from 'react';
import type { PackagingType } from '../../types';
import { cn, formatNumber } from '../../lib/utils';

interface InventoryStatsProps {
  activeTab: 'COMMODITIES' | 'PACKAGING';
  inventory: Record<string, number>;
  packagingInventory: Partial<Record<PackagingType, number>>;
}

const DEFAULT_COMMODITIES = ['COCOA', 'CASHEW', 'PK'];
const PACKAGING: PackagingType[] = ['JUTE_BAG', 'NYLON_BAG'];

export default function InventoryStats({ activeTab, inventory, packagingInventory }: InventoryStatsProps) {
  const commodities = useMemo(() => {
    const extra = Object.keys(inventory).filter(k => !DEFAULT_COMMODITIES.includes(k) && Math.abs(inventory[k]) > 0.004).sort();
    return [...DEFAULT_COMMODITIES, ...extra];
  }, [inventory]);

  const items = activeTab === 'COMMODITIES'
    ? commodities.map(c => ({ key: c, label: c, value: inventory[c] || 0, unit: 'kg', decimals: 2 }))
    : PACKAGING.map(p => ({ key: p, label: p.replace('_', ' '), value: packagingInventory[p] || 0, unit: 'bags', decimals: 0 }));

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {items.map(item => (
        <div key={item.key} className="google-card p-3 text-center">
          <p className="text-[9px] font-bold text-[var(--text-secondary)] uppercase mb-1">{item.label}</p>
          <p className={cn('text-sm font-bold', item.value < 0 ? 'text-rose-600' : 'text-[var(--text-primary)]')}>
            {formatNumber(item.value, item.decimals)} {item.unit}
          </p>
        </div>
      ))}
    </div>
  );
}
