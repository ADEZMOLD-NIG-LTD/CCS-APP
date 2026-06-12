/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';

interface DigitFormattedInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value?: string | number;
  defaultValue?: string | number;
  onChange?: (rawValue: string) => void;
  suffix?: string;
  prefix?: string;
  name?: string;
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
  ...props
}: DigitFormattedInputProps) {
  
  // Format numeric string to grouped format with commas (e.g. "1234567.89" -> "1,234,567.89")
  function formatValue(val: string): string {
    if (val === undefined || val === null || val === '') return '';
    
    let str = String(val).replace(/,/g, '');
    if (isNaN(Number(str)) && str !== '.' && str !== '-') return val;

    const parts = str.split('.');
    const isNegative = parts[0].startsWith('-');
    const intPart = isNegative ? parts[0].substring(1) : parts[0];

    const formattedInt = intPart ? Number(intPart).toLocaleString('en-US') : '';
    const resultInt = isNegative ? `-${formattedInt}` : formattedInt;

    if (parts.length > 1) {
      return `${resultInt}.${parts[1]}`;
    }
    return resultInt;
  }

  // Parse entered text back to clean raw numeric string (e.g. "1,234,567.89" -> "1234567.89")
  function parseValue(val: string): string {
    let clean = val.replace(/,/g, '');
    const isNegative = clean.startsWith('-');
    if (isNegative) {
      clean = clean.substring(1);
    }

    const dotIndex = clean.indexOf('.');
    if (dotIndex !== -1) {
      const intPart = clean.substring(0, dotIndex).replace(/\D/g, '');
      const decPart = clean.substring(dotIndex + 1).replace(/\D/g, '');
      clean = `${intPart}.${decPart}`;
    } else {
      clean = clean.replace(/\D/g, '');
    }

    return isNegative ? `-${clean}` : clean;
  }

  const getInitialValue = () => {
    const val = value !== undefined ? value : (defaultValue !== undefined ? defaultValue : '');
    return formatValue(String(val));
  };

  const [displayValue, setDisplayValue] = useState<string>(getInitialValue);
  const [rawValue, setRawValue] = useState<string>(() => parseValue(String(value !== undefined ? value : (defaultValue !== undefined ? defaultValue : ''))));

  // Sync with value prop updates from parent
  useEffect(() => {
    if (value !== undefined) {
      const parsed = parseValue(String(value));
      setRawValue(parsed);
      setDisplayValue(formatValue(parsed));
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = parseValue(e.target.value);
    const formatted = formatValue(rawVal);
    
    setDisplayValue(formatted);
    setRawValue(rawVal);
    
    if (onChange) {
      onChange(rawVal);
    }
  };

  return (
    <div className="relative w-full">
      {prefix && (
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm select-none z-10">
          {prefix}
        </span>
      )}
      <input
        type="text"
        value={displayValue}
        onChange={handleChange}
        placeholder={placeholder}
        className={`${className} ${prefix ? 'pl-8' : ''} ${suffix ? 'pr-12' : ''}`}
        {...props}
      />
      {suffix && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold select-none z-10">
          {suffix}
        </span>
      )}
      {/* Hidden input field containing the raw value so standard form submissions work out of the box */}
      {name && (
        <input type="hidden" name={name} value={rawValue} />
      )}
    </div>
  );
}
