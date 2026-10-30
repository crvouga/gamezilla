/** @jsxImportSource solid-js */

import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
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
  /**
   * `false` takes the chip out of the tab order, for a group that moves
   * focus between its chips with the arrow keys. Default `true`.
   */
  tabStop?: boolean | undefined;
  /** Keys pressed on the chip (a group's arrow-key navigation). */
  onKeyDown?: ((event: KeyboardEvent) => void) | undefined;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
};

/**
 * `Chip` -- compact tag / filter / choice element.
 *
 * A 32px tag at the small radius (`skin.css` `.chip`), 14px semibold, with a
 * 44px hit area (`.hitTarget`):
 *   - Unselected is transparent inside the 3:1 `outline` edge with an ink
 *     label; on hover the edge darkens to the secondary ink.
 *   - Selected is the soft blue: `tint-subtle` fill, `primary-strong` edge,
 *     `on-primary-soft` label.
 *
 * Hover / press tint from the `.clickableTint` overlay, the keyboard focus
 * ring from `.clickable`, and the disabled opacity. The state is announced,
 * never carried by color alone: a toggle chip is `aria-pressed`, a chip in a
 * single-choice `ChipGroup` is a `radio` with `aria-checked`.
 */
export function Chip(props: ChipProps): JSX.Element {
  const selected = (): boolean => props.selected === true;
  const role = (): 'button' | 'radio' => props.role ?? 'button';
  return (
    <button
      class="clickable clickableTint hitTarget chip self-start flex-row items-center justify-center gap-2"
      {...dataAttrs({ component: 'Chip', ...props.dataSet })}
      type="button"
      role={role()}
      aria-pressed={role() === 'button' ? selected() : undefined}
      aria-checked={role() === 'radio' ? selected() : undefined}
      tabIndex={props.tabStop === false ? -1 : undefined}
      onClick={() => props.onClick?.()}
      onKeyDown={(event) => props.onKeyDown?.(event)}
      disabled={props.disabled === true}
    >
      <Show when={props.startIcon !== undefined}>
        <div class="box h-4 items-center justify-center">{props.startIcon}</div>
      </Show>
      <span class="text textLabel line-clamp-1">{props.label}</span>
    </button>
  );
}
