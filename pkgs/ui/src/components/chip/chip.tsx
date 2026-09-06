/** @jsxImportSource solid-js */
/**
 * `Chip` -- compact tag / filter element.
 *
 * Flat surface chip with a hairline border in both states:
 *   - Unselected reads as a quiet pill (`surface` fill + `border` outline +
 *     `text` foreground).
 *   - Selected lifts the brand color (`tintHighlight` fill + `tint` border +
 *     `tint` foreground) without feeling shouty next to its peers.
 *
 * Hover/press is delegated to {@link Clickable}'s tint overlay. Exposes
 * `aria-pressed` so the selected state is announced.
 *
 * @example
 * ```tsx
 * <Chip label="Solid" selected={sel()} onClick={() => setSel(!sel())} />
 * <Chip label="With icon" startIcon={<PlusIcon size={16} />} />
 * ```
 */

import { type JSX, Show } from 'solid-js';
import type { ComponentDataSet } from '../../component-id';
import { Box } from '../box';
import { Clickable } from '../clickable';
import { Text } from '../text';

export type ChipProps = {
  label: JSX.Element;
  selected?: boolean | undefined;
  onClick?: (() => void) | undefined;
  disabled?: boolean | undefined;
  /** Rendered before the label (sized to match the chip text). */
  startIcon?: JSX.Element | undefined;
  /** ARIA role. Defaults to `button` (with `aria-pressed`); `ChipGroup` uses `radio`. */
  role?: 'button' | 'radio' | undefined;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
};

/** Fixed pill height so every chip in a row shares one baseline. */
export const CHIP_HEIGHT = 32;
/** Short labels ("All") stay pill-shaped instead of collapsing to a circle. */
const CHIP_MIN_WIDTH = 56;
const CHIP_ICON_SIZE = 16;

export function Chip(props: ChipProps): JSX.Element {
  const selected = (): boolean => props.selected === true;
  const role = (): 'button' | 'radio' => props.role ?? 'button';
  return (
    <Clickable
      role={role()}
      aria-pressed={role() === 'button' ? selected() : undefined}
      aria-checked={role() === 'radio' ? selected() : undefined}
      onClick={() => props.onClick?.()}
      disabled={props.disabled === true}
      dataSet={{ component: 'Chip', ...props.dataSet }}
      sx={{
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1.5,
        px: 3,
        height: CHIP_HEIGHT,
        minWidth: CHIP_MIN_WIDTH,
        borderRadius: 'full',
        borderWidth: 1,
        borderColor: selected() ? 'tint' : 'border',
        backgroundColor: selected() ? 'tintHighlight' : 'surface',
        opacity: props.disabled === true ? 0.5 : 1,
        transitionProperty: 'background-color, border-color, color',
        transitionDuration: 'var(--ui-duration-fast)',
      }}
    >
      <Show when={props.startIcon !== undefined}>
        <Box
          sx={{
            alignItems: 'center',
            justifyContent: 'center',
            height: CHIP_ICON_SIZE,
          }}
        >
          {props.startIcon}
        </Box>
      </Show>
      <Text
        variant="label"
        numberOfLines={1}
        sx={{
          color: selected() ? 'tint' : 'text',
          fontSize: 13,
          lineHeight: 18,
          fontWeight: '600',
        }}
        label={props.label}
      />
    </Clickable>
  );
}
