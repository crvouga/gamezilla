/** @jsxImportSource solid-js */
/**
 * Trigger row for {@link Picker}: preview swatch, current label (or
 * placeholder), and a disclosure chevron. Renders a real `<button>` with
 * `aria-haspopup="listbox"` / `aria-expanded`.
 */

import type { LocalizedString } from '@pkgs/i18n/localized-string';
import { type JSX, Show } from 'solid-js';
import type { SxProps } from '../../theme';
import { Box } from '../box';
import { Clickable } from '../clickable';
import { ChevronDownIcon } from '../icons';
import { Text } from '../text';
import type { PickerOption, PickerSize, PickerValue } from './picker-types';

/** Minimum pointer target for the default-size trigger. */
export const PICKER_TRIGGER_MIN_HEIGHT = 44;
/** Compact trigger height (dense chrome, e.g. tab bars). */
export const PICKER_TRIGGER_COMPACT_HEIGHT = 32;

export type PickerTriggerProps<T extends PickerValue> = {
  selected: PickerOption<T> | undefined;
  placeholder: LocalizedString;
  disabled: boolean;
  size: PickerSize;
  open: boolean;
  onClick: () => void;
  'aria-label': string | undefined;
};

export function PickerLabel(props: { label: JSX.Element }): JSX.Element {
  return (
    <Text
      variant="caption"
      sx={{ mb: 0.5, color: 'textSecondary' }}
      label={props.label}
    />
  );
}

function triggerSx(compact: boolean, disabled: boolean): SxProps {
  return {
    borderRadius: 'md',
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
    width: '100%',
    ...(compact ? { height: PICKER_TRIGGER_COMPACT_HEIGHT } : {}),
    minHeight: compact
      ? PICKER_TRIGGER_COMPACT_HEIGHT
      : PICKER_TRIGGER_MIN_HEIGHT,
    paddingHorizontal: compact ? 8 : 12,
    paddingVertical: compact ? 0 : 10,
    borderWidth: 1,
    borderColor: 'outline',
    backgroundColor: 'surfaceMuted',
    gap: compact ? 1.5 : 2.5,
    opacity: disabled ? 0.4 : 1,
    textAlign: 'left',
  };
}

export function PickerTrigger<T extends PickerValue>(
  props: PickerTriggerProps<T>
): JSX.Element {
  const compact = (): boolean => props.size === 'sm';
  const hasSelection = (): boolean => props.selected !== undefined;
  return (
    <Clickable
      onClick={() => props.onClick()}
      disabled={props.disabled}
      aria-haspopup="listbox"
      aria-expanded={props.open}
      aria-label={props['aria-label']}
      dataSet={{ component: 'PickerTrigger' }}
      sx={triggerSx(compact(), props.disabled)}
    >
      <Show when={props.selected?.preview !== undefined}>
        <Box sx={{ flexShrink: 0 }}>{props.selected?.preview}</Box>
      </Show>
      <Text
        variant={compact() ? 'caption' : 'label'}
        numberOfLines={1}
        sx={[
          {
            flex: 1,
            minWidth: 0,
            flexShrink: 1,
            color: hasSelection() ? 'text' : 'textSecondary',
          },
          compact() && { fontSize: 12, lineHeight: 16, fontWeight: '500' },
        ]}
        label={props.selected?.label ?? props.placeholder}
      />
      <ChevronDownIcon size={compact() ? 14 : 18} color="textSecondary" />
    </Clickable>
  );
}
