/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';

interface DigitFormattedInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'defaultValue'> {
  value?: string | number;
  defaultValue?: string | number;
  /** Receives the raw numeric string without separators, e.g. "1234.5". */
  onChange?: (rawValue: string) => void;
  suffix?: string;
  prefix?: string;
  name?: string;
  /** Negative values are rejected unless explicitly allowed (e.g. opening balances). */
  allowNegative?: boolean;
  /** Maximum decimal places accepted. Defaults to 2 for money; weights pass WEIGHT_DECIMALS. */
  decimals?: number;
}

function formatValue(raw: string): string {
  if (raw === '' || raw === '-') return raw;
  const isNegative = raw.startsWith('-');
  const body = isNegative ? raw.slice(1) : raw;
  const [intPart, decPart] = body.split('.');
  const formattedInt = intPart ? Number(intPart).toLocaleString('en-US') : '0';
  const result = decPart !== undefined ? `${formattedInt}.${decPart}` : formattedInt;
  return isNegative ? `-${result}` : result;
}

function parseValue(input: string, allowNegative: boolean, decimals: number): string {
  let clean = input.replace(/,/g, '').trim();
  const isNegative = allowNegative && clean.startsWith('-');
  clean = clean.replace(/-/g, '');
  const dotIndex = clean.indexOf('.');
  if (dotIndex !== -1) {
    const intPart = clean.slice(0, dotIndex).replace(/\D/g, '');
    const decPart = decimals > 0 ? clean.slice(dotIndex + 1).replace(/\D/g, '').slice(0, decimals) : '';
    clean = decimals > 0 ? `${intPart}.${decPart}` : intPart;
  } else {
    clean = clean.replace(/\D/g, '');
  }
  // Remove leading zeros ("007" -> "7") but keep "0" and "0.x".
  clean = clean.replace(/^0+(?=\d)/, '');
  return isNegative ? `-${clean}` : clean;
}

export function DigitFormattedInput({
  value,
  defaultValue,
  onChange,
  suffix,
  prefix,
  name,
  className,
  placeholder,
  allowNegative = false,
  decimals = 2,
  ...props
}: DigitFormattedInputProps) {
  const initial = parseValue(String(value ?? defaultValue ?? ''), allowNegative, decimals);
  const [rawValue, setRawValue] = useState<string>(initial);

  useEffect(() => {
    if (value !== undefined) {
      setRawValue(parseValue(String(value), allowNegative, decimals));
    }
  }, [value, allowNegative, decimals]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = parseValue(e.target.value, allowNegative, decimals);
    setRawValue(next);
    onChange?.(next);
  };

  return (
    <div className="relative w-full min-w-0">
      {prefix && (
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm select-none z-10">{prefix}</span>
      )}
      <input
        type="text"
        inputMode="decimal"
        value={formatValue(rawValue)}
        onChange={handleChange}
        placeholder={placeholder}
        className={`${className ?? ''} ${prefix ? 'pl-8' : ''} ${suffix ? 'pr-12' : ''}`}
        {...props}
      />
      {suffix && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold select-none z-10">{suffix}</span>
      )}
      {name && <input type="hidden" name={name} value={rawValue} />}
    </div>
  );
}
