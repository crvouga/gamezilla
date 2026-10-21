/** @jsxImportSource solid-js */
/**
 * `Chip` -- compact tag / filter element.
 *
 * A 32px pill (`skin.css` `.chip`), 14px semibold:
 *   - Unselected is a quiet hairline pill on the canvas in text color; on
 *     hover the hairline darkens to the outline tone.
 *   - Selected is the blue fill with an on-primary label, like every other
 *     "this one".
 *
 * Hover / press tint from the `.clickableTint` overlay, the keyboard focus
 * ring from `.clickable`, and the disabled opacity. Exposes `aria-pressed`
 * (or `aria-checked` as a radio) so the selected state is announced.
 */

import type { ComponentDataSet } from '@pkgs/ui-root-shared/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared/component-id';
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

export function Chip(props: ChipProps): JSX.Element {
  const selected = (): boolean => props.selected === true;
  const role = (): 'button' | 'radio' => props.role ?? 'button';
  return (
    <button
      class="clickable clickableTint chip self-start flex-row items-center justify-center gap-2"
      {...dataAttrs({ component: 'Chip', ...props.dataSet })}
      type="button"
      role={role()}
      aria-pressed={role() === 'button' ? selected() : undefined}
      aria-checked={role() === 'radio' ? selected() : undefined}
      onClick={() => props.onClick?.()}
      disabled={props.disabled === true}
    >
      <Show when={props.startIcon !== undefined}>
        <div class="box h-4 items-center justify-center">{props.startIcon}</div>
      </Show>
      <span class="text textLabel line-clamp-1">{props.label}</span>
    </button>
  );
}
