import React, { useState } from 'react';

export const STANDARD_COMMODITIES = ['COCOA', 'CASHEW', 'PK'];

const LABELS: Record<string, string> = { COCOA: 'Cocoa', CASHEW: 'Cashew', PK: 'Palm Kernel (PK)' };

interface CommodityPickerProps {
  value: string;
  onChange: (commodity: string) => void;
  className?: string;
  disabled?: boolean;
}

/** Standard commodities plus a free-text "other" option. */
export default function CommodityPicker({ value, onChange, className, disabled }: CommodityPickerProps) {
  const isStandard = STANDARD_COMMODITIES.includes(value);
  const [custom, setCustom] = useState(!isStandard && !!value);
  const [customName, setCustomName] = useState(isStandard ? '' : value);

  return (
    <div className="flex flex-col gap-2">
      <select
        value={custom ? 'OTHER' : value}
        disabled={disabled}
        onChange={e => {
          if (e.target.value === 'OTHER') {
            setCustom(true);
            onChange(customName.trim().toUpperCase());
          } else {
            setCustom(false);
            onChange(e.target.value);
          }
        }}
        className={className}
        required
      >
        {STANDARD_COMMODITIES.map(c => <option key={c} value={c}>{LABELS[c]}</option>)}
        <option value="OTHER">Other (custom item)</option>
      </select>
      {custom && (
        <input
          type="text"
          required
          maxLength={60}
          disabled={disabled}
          placeholder="Item name"
          value={customName}
          onChange={e => {
            setCustomName(e.target.value);
            onChange(e.target.value.trim().toUpperCase());
          }}
          className={className}
        />
      )}
    </div>
  );
}
