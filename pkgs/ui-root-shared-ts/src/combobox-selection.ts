/**
 * Framework-free selection helpers for {@link Combobox}.
 */

import type {
  ComboboxMultipleProps,
  ComboboxOption,
  ComboboxProps,
  ComboboxValue,
} from './combobox-types';

export function isMultipleComboboxProps<T extends ComboboxValue>(
  candidate: ComboboxProps<T>
): candidate is ComboboxMultipleProps<T> {
  return candidate.selectionMode === 'multiple';
}

/** Add `next` when absent, remove it when present (order preserved). */
export function toggleSelectedValue<T extends ComboboxValue>(
  current: readonly T[],
  next: T
): T[] {
  if (current.includes(next)) {
    return current.filter((v) => v !== next);
  }
  return [...current, next];
}

export function removeSelectedValue<T extends ComboboxValue>(
  current: readonly T[],
  value: T
): T[] {
  return current.filter((v) => v !== value);
}

/** Options whose value is in `values`, in option order. */
export function selectedOptionsFor<T extends ComboboxValue>(
  options: readonly ComboboxOption<T>[],
  values: readonly T[]
): ComboboxOption<T>[] {
  const set = new Set(values);
  return options.filter((option) => set.has(option.value));
}

export function isValueSelected<T extends ComboboxValue>(
  value: T | null | undefined,
  values: ReadonlySet<T> | undefined,
  itemValue: T
): boolean {
  if (values !== undefined) return values.has(itemValue);
  return itemValue === value;
}
