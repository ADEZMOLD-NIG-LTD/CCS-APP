import React from 'react';
import { CommodityType, PackagingType } from '../../types';
import { formatNumber } from '../../lib/utils';

interface InventoryStatsProps {
  activeTab: 'COMMODITIES' | 'PACKAGING';
  inventory: Record<string, number>;
  packagingInventory: Record<PackagingType, number>;
}

export default function InventoryStats({
  activeTab,
  inventory,
  packagingInventory
}: InventoryStatsProps) {
  const PACKAGING: PackagingType[] = ['JUTE_BAG', 'NYLON_BAG'];

  const commoditiesToRender = React.useMemo(() => {
    const keys = Object.keys(inventory || {});
    const defaults = ['COCOA', 'CASHEW', 'PK'];
    const otherKeys = keys.filter(k => !defaults.includes(k) && inventory[k] !== 0).sort();
    return [...defaults, ...otherKeys];
  }, [inventory]);

  return (
    <div className="grid grid-cols-3 gap-3">
      {activeTab === 'COMMODITIES' ? (
        commoditiesToRender.map(c => (
          <div key={c} className="google-card p-3 text-center">
            <p className="text-[9px] font-bold text-[var(--text-secondary)] uppercase mb-1">{c}</p>
            <p className="text-sm font-bold text-[var(--text-primary)]">{formatNumber(inventory[c] || 0)} kg</p>
          </div>
        ))
      ) : (
        PACKAGING.map(p => (
          <div key={p} className="google-card p-3 text-center">
            <p className="text-[9px] font-bold text-[var(--text-secondary)] uppercase mb-1">{p.replace('_', ' ')}</p>
            <p className="text-sm font-bold text-[var(--text-primary)]">{formatNumber(packagingInventory[p] || 0, 0)} pcs</p>
          </div>
        ))
      )}
    </div>
  );
}
