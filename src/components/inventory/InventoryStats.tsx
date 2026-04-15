/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { CommodityType, PackagingType } from '../../types';

const COMMODITIES: CommodityType[] = ['COCOA', 'CASHEW', 'PK'];
const PACKAGING: PackagingType[] = ['JUTE_BAG', 'NYLON_BAG'];

interface InventoryStatsProps {
  activeTab: 'COMMODITIES' | 'PACKAGING';
  inventory: Record<CommodityType, number>;
  packagingInventory: Record<PackagingType, number>;
}

export default function InventoryStats({
  activeTab,
  inventory,
  packagingInventory
}: InventoryStatsProps) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {activeTab === 'COMMODITIES' ? (
        COMMODITIES.map(c => (
          <div key={c} className="google-card p-3 text-center">
            <p className="text-[9px] font-bold text-[var(--text-secondary)] uppercase mb-1">{c}</p>
            <p className="text-sm font-bold text-[var(--text-primary)]">{(inventory[c] || 0).toLocaleString()} kg</p>
          </div>
        ))
      ) : (
        PACKAGING.map(p => (
          <div key={p} className="google-card p-3 text-center">
            <p className="text-[9px] font-bold text-[var(--text-secondary)] uppercase mb-1">{p.replace('_', ' ')}</p>
            <p className="text-sm font-bold text-[var(--text-primary)]">{(packagingInventory[p] || 0).toLocaleString()} pcs</p>
          </div>
        ))
      )}
    </div>
  );
}
