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
 */

import type { ComponentDataSet } from '@pkgs/ui-shared/component-id';
import { dataAttrs } from '@pkgs/ui-shared/component-id';
import { type JSX, Show } from 'solid-js';

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
    <button
      class="clickable clickableTint chip self-start flex-row items-center justify-center gap-1.5"
      {...dataAttrs({ component: 'Chip', ...props.dataSet })}
      type="button"
      style={{
        height: `${CHIP_HEIGHT}px`,
        'min-width': `${CHIP_MIN_WIDTH}px`,
      }}
      role={role()}
      aria-pressed={role() === 'button' ? selected() : undefined}
      aria-checked={role() === 'radio' ? selected() : undefined}
      onClick={() => props.onClick?.()}
      disabled={props.disabled === true}
    >
      <Show when={props.startIcon !== undefined}>
        <div
          class="box items-center justify-center"
          style={{ height: `${CHIP_ICON_SIZE}px` }}
        >
          {props.startIcon}
        </div>
      </Show>
      <span class="text textLabel line-clamp-1">{props.label}</span>
    </button>
  );
}
