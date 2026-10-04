/** @jsxImportSource solid-js */
/**
 * `Select` -- modal / bottom-sheet picker for choosing from a list of options.
 *
 * Implemented on top of {@link Picker} (same public props); the labelled
 * trigger button shows the current option and opens the option listbox.
 */

import type {
  PickerOption,
  PickerProps,
  PickerValue,
} from '@pkgs/ui-shared/picker-types';
import type { JSX } from 'solid-js';
import { Picker } from './picker';

export type SelectOption<T extends PickerValue = string> = PickerOption<T>;

export type SelectProps<T extends PickerValue = string> = PickerProps<T>;

export function Select<T extends PickerValue = string>(
  props: SelectProps<T>
): JSX.Element {
  return (
    <Picker {...props} dataSet={{ component: 'Select', ...props.dataSet }} />
  );
}
