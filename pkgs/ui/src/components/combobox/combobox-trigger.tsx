/** @jsxImportSource solid-js */
/**
 * Field row for {@link Combobox}: selected chips (multi), the opener button
 * (`role="combobox"`, `aria-expanded`, `aria-controls`), and a clear
 * control for multi-select. Every interactive part is a sibling `<button>`.
 */

import { useLingui } from '@lingui/solid/macro';
import type { LocalizedString } from '@pkgs/i18n/localized-string';
import { type JSX, Show } from 'solid-js';
import type { ComponentDataSet } from '../../component-id';
import { Box } from '../box';
import { Clickable } from '../clickable';
import { IconButton } from '../icon-button';
import { ChevronDownIcon, XIcon } from '../icons';
import { Text } from '../text';
import { ComboboxChips } from './combobox-chips';
import type { ComboboxOption, ComboboxValue } from './combobox-types';

/** Minimum pointer target for the opener button. */
export const COMBOBOX_TRIGGER_MIN_HEIGHT = 44;

export function ComboboxLabel(props: { label: JSX.Element }): JSX.Element {
  return (
    <Text
      variant="caption"
      sx={{ mb: 0.5, color: 'textSecondary' }}
      label={props.label}
    />
  );
}

export type ComboboxTriggerProps<T extends ComboboxValue> = {
  selected: ComboboxOption<T> | undefined;
  selectedOptions: readonly ComboboxOption<T>[];
  multiple: boolean;
  placeholder: LocalizedString;
  disabled: boolean;
  open: boolean;
  listboxId: string;
  onOpen: () => void;
  /** Multi-select only: clear every value. */
  onClear: (() => void) | undefined;
  onRemove: (value: T) => void;
  'aria-label': string | undefined;
  dataSet: ComponentDataSet | undefined;
};

function SingleSummary<T extends ComboboxValue>(props: {
  selected: ComboboxOption<T> | undefined;
  placeholder: LocalizedString;
}): JSX.Element {
  return (
    <>
      <Show when={props.selected?.preview !== undefined}>
        <Box sx={{ flexShrink: 0 }}>{props.selected?.preview}</Box>
      </Show>
      <Text
        variant="label"
        numberOfLines={1}
        sx={{
          flex: 1,
          minWidth: 0,
          color: props.selected !== undefined ? 'text' : 'textSecondary',
        }}
        label={props.selected?.label ?? props.placeholder}
      />
    </>
  );
}

export function ComboboxTrigger<T extends ComboboxValue>(
  props: ComboboxTriggerProps<T>
): JSX.Element {
  const { t } = useLingui();
  const hasChips = (): boolean =>
    props.multiple && props.selectedOptions.length > 0;
  const showClear = (): boolean => props.onClear !== undefined && hasChips();
  return (
    <Box
      dataSet={{ component: 'ComboboxField' }}
      sx={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
        paddingLeft: hasChips() ? 8 : 0,
        borderRadius: 'md',
        borderWidth: 1,
        borderColor: 'outline',
        backgroundColor: 'surfaceMuted',
        opacity: props.disabled ? 0.4 : 1,
      }}
    >
      <Show when={hasChips()}>
        <ComboboxChips
          selected={props.selectedOptions}
          onRemove={props.onRemove}
          disabled={props.disabled}
        />
      </Show>
      <Clickable
        role="combobox"
        aria-expanded={props.open}
        aria-controls={props.listboxId}
        aria-haspopup="listbox"
        aria-label={props['aria-label']}
        disabled={props.disabled}
        onClick={() => props.onOpen()}
        dataSet={{ component: 'ComboboxTrigger', ...props.dataSet }}
        sx={{
          flex: 1,
          minWidth: 0,
          minHeight: COMBOBOX_TRIGGER_MIN_HEIGHT,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 2.5,
          paddingHorizontal: 12,
          paddingVertical: 10,
          borderRadius: 'md',
          textAlign: 'left',
        }}
      >
        <Show
          when={props.multiple}
          fallback={
            <SingleSummary
              selected={props.selected}
              placeholder={props.placeholder}
            />
          }
        >
          <Text
            variant="label"
            numberOfLines={1}
            sx={{ flex: 1, minWidth: 0, color: 'textSecondary' }}
            label={hasChips() ? t`Add…` : props.placeholder}
          />
        </Show>
        <ChevronDownIcon size={18} color="textSecondary" />
      </Clickable>
      <Show when={showClear()}>
        <Box sx={{ pr: 1 }}>
          <IconButton
            label={t`Clear`}
            size={32}
            tooltip="none"
            disabled={props.disabled}
            onClick={() => props.onClear?.()}
            dataSet={{ component: 'ComboboxClear' }}
          >
            <XIcon size={16} color="textSecondary" />
          </IconButton>
        </Box>
      </Show>
    </Box>
  );
}
