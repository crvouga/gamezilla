import type { LocalizedString } from '@pkgs/i18n-shared/localized-string';
import type { JSX } from 'solid-js';
import type { ComponentDataSet } from './component-id';

export type PickerSize = 'sm' | 'md';

export type PickerValue = string | number;

export type PickerOption<T extends PickerValue = string> = {
  label: JSX.Element;
  value: T;
  /** Leading swatch / thumbnail shown in the trigger and the option row. */
  preview?: JSX.Element | undefined;
  /** Grayed out; not selectable. */
  disabled?: boolean | undefined;
  /**
   * Text used for type-ahead and the optional search box when `label` is not
   * a plain string.
   */
  searchText?: string | undefined;
  /** DOM `data-*` identifiers for the option row. */
  dataSet?: ComponentDataSet | undefined;
};

export type PickerRenderOption<T extends PickerValue> = (
  option: PickerOption<T>,
  selected: boolean,
  onPick: () => void
) => JSX.Element;

export type PickerProps<T extends PickerValue = string> = {
  options: readonly PickerOption<T>[];
  value: T;
  onValueChange: (value: T) => void;
  /** Optional label above the trigger. */
  label?: JSX.Element | undefined;
  /** Title in the surface; defaults to `label` when set, else `"Choose"`. */
  surfaceTitle?: JSX.Element | undefined;
  /** Content rendered at the top of the surface body (below the title). */
  surfaceExtra?: JSX.Element | undefined;
  disabled?: boolean | undefined;
  /**
   * When true, the open surface shows a spinner instead of options.
   * Does not disable the trigger.
   */
  loading?: boolean | undefined;
  /**
   * When set (and not loading), the open surface shows a compact error above
   * the option list. Does not disable the trigger.
   */
  error?: JSX.Element | undefined;
  placeholder?: LocalizedString | undefined;
  /** Compact trigger for dense chrome (e.g. tab bars). Default `'md'`. */
  size?: PickerSize | undefined;
  /** Show a search box above the options that filters by label / `searchText`. */
  searchable?: boolean | undefined;
  searchPlaceholder?: LocalizedString | undefined;
  /** Custom row renderer; default renders label + preview + check mark. */
  renderOption?: PickerRenderOption<T> | undefined;
  /** Accessible name for the trigger when `label` is not a plain string. */
  'aria-label'?: string | undefined;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
  /** DOM `data-*` identifiers for the trigger button. */
  triggerDataSet?: ComponentDataSet | undefined;
};
