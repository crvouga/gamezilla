import { combobox } from '@ui-sdk/core/combobox';
import { select } from '@ui-sdk/core/select';
import { createParts } from '@ui-sdk/solid/primitive';
import type { JSX } from '@solidjs/web';

// ResponsiveSurface hosts the list in a dialog, including the searchable
// and virtualized variants. Only the SDK trigger mounts on the closed field.
export const SelectParts = createParts(select, { trigger: 'button', label: 'p' });
export const ComboboxParts = createParts(combobox, { trigger: 'button', label: 'p' });

export function pickerItems<T extends string | number>(
  options: readonly { value: T; label: JSX.Element; searchText?: string | undefined; disabled?: boolean | undefined }[],
  loading: boolean
) {
  return options.map((option) => ({
    value: option.value,
    label: typeof option.label === 'string' ? option.label : option.searchText ?? String(option.value),
    disabled: loading || option.disabled === true,
  }));
}
