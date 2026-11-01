import { useState } from 'react';
import type { CSSProperties } from 'react';
import type { Option } from '../constants';

interface NumberFieldProps {
  id?: string;
  value: number;
  onChange: (value: number) => void;
  step?: number;
  min?: number;
  max?: number;
  disabled?: boolean;
  className?: string;
  style?: CSSProperties;
  ariaLabel?: string;
  onFocus?: () => void;
}

/**
 * Numeric input that keeps the user's raw text while typing and only commits
 * finite values within [min, max]. Invalid text reverts on blur.
 */
export function NumberField(props: NumberFieldProps) {
  const { id, value, onChange, step, min, max, disabled, className, style, ariaLabel, onFocus } = props;
  const [text, setText] = useState(String(value));
  const [prevValue, setPrevValue] = useState(value);

  // Sync synchronously when the value changes from outside (e.g. a duplicated input elsewhere).
  if (value !== prevValue) {
    setPrevValue(value);
    if (parseFloat(text) !== value) setText(String(value));
  }

  const isValid = (n: number) =>
    Number.isFinite(n) && (min === undefined || n >= min) && (max === undefined || n <= max);

  return (
    <input
      type="number"
      id={id}
      value={text}
      step={step}
      min={min}
      max={max}
      disabled={disabled}
      className={className}
      style={style}
      aria-label={ariaLabel}
      onFocus={onFocus}
      onChange={(e) => {
        setText(e.target.value);
        const n = parseFloat(e.target.value);
        if (isValid(n)) onChange(n);
      }}
      onBlur={() => setText(String(value))}
    />
  );
}

interface SelectFieldProps<T extends string | number> {
  id?: string;
  value: T;
  options: readonly Option<T>[];
  onChange: (value: T) => void;
  disabled?: boolean;
}

export function SelectField<T extends string | number>({ id, value, options, onChange, disabled }: SelectFieldProps<T>) {
  return (
    <select
      id={id}
      value={String(value)}
      disabled={disabled}
      onChange={(e) => {
        const opt = options.find((o) => String(o.value) === e.target.value);
        if (opt) onChange(opt.value);
      }}
    >
      {options.map((o) => (
        <option key={String(o.value)} value={String(o.value)}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
