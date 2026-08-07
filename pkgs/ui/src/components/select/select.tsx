/**
 * `Select` — modal / bottom-sheet picker for choosing from a list of options.
 *
 * Implemented on top of {@link Picker} (same public props as before).
 */

import { type ComponentDataSet, componentDataSet } from '../../component-id';
import { Picker, type PickerOption, type PickerProps } from '../picker';

export type SelectOption<T extends string | number = string> = PickerOption<T>;

export type SelectProps<T extends string | number = string> = PickerProps<T> & {
  /** Web DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet;
};

export function Select<T extends string | number = string>({
  dataSet,
  ...props
}: SelectProps<T>) {
  return <Picker {...props} {...componentDataSet('Select', dataSet)} />;
}
