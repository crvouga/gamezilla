import type { JSX } from '@solidjs/web';
import { combobox } from '@ui-sdk/core/combobox';
import { select } from '@ui-sdk/core/select';
import { createParts } from '@ui-sdk/solid/primitive';

// ResponsiveSurface hosts the list in a dialog, including the searchable
// and virtualized variants. Only the SDK trigger mounts on the closed field.
export const SelectParts = createParts(select, {
  trigger: 'button',
  label: 'p',
});
export const ComboboxParts = createParts(combobox, {
  trigger: 'button',
  label: 'p',
});

export function pickerItems<T extends string | number>(
  options: readonly {
    value: T;
    label: JSX.Element;
    searchText?: string | undefined;
    disabled?: boolean | undefined;
  }[],
  loading: boolean
) {
  return options.map((option) => ({
    value: option.value,
    label:
      typeof option.label === 'string'
        ? option.label
        : (option.searchText ?? String(option.value)),
    disabled: loading || option.disabled === true,
  }));
}

export function selectedPickerValues<T extends string | number>(
  options: readonly { value: T }[],
  values: readonly unknown[]
): T[] | undefined {
  const selected: T[] = [];
  for (const value of values) {
    const exact = options.find((option) => option.value === value);
    const match =
      exact ?? options.find((option) => String(option.value) === value);
    if (!match || selected.includes(match.value)) return undefined;
    selected.push(match.value);
  }
  return selected;
}
