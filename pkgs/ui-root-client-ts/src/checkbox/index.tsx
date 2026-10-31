/** @jsxImportSource solid-js */

import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { type JSX, Show } from 'solid-js';

export type CheckboxProps = {
  /** Current selection; the parent owns and updates this value. */
  checked: boolean;
  /** Receives the next selection; activating an indeterminate box selects it. */
  onToggle: (next: boolean) => void;
  /** Optional label displayed next to the checkbox. */
  label?: JSX.Element | undefined;
  /** When true, shows the indeterminate (dash) glyph. */
  indeterminate?: boolean | undefined;
  /** Prevent changing an unavailable choice while keeping it visible. */
  disabled?: boolean | undefined;
  /** Accessible name when no visible label is supplied. */
  'aria-label'?: string | undefined;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
};

function CheckboxGlyph(props: { indeterminate: boolean }): JSX.Element {
  return (
    <svg class="size-4" viewBox="0 0 16 16" aria-hidden="true">
      <Show
        when={!props.indeterminate}
        fallback={
          <rect x="3" y="7" width="10" height="2" rx="1" fill="currentColor" />
        }
      >
        <path
          d="M3.5 8.5 L6.5 11.5 L12.5 4.5"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </Show>
    </svg>
  );
}

/**
 * Select an independent choice, such as an invitation preference in a form.
 * Use Switch for a setting that takes effect immediately.
 *
 * `Checkbox` -- checked / unchecked / indeterminate control.
 *
 * A 20px box with the small radius and an outline border (`skin.css`
 * `.checkboxBox`); checked or mixed is the soft tint (`tint-subtle` fill,
 * `primary-strong` edge) with an `on-primary-soft` check or dash, so the
 * glyph, not only the color, says which. The whole row (box and label) is
 * the hit area, at least 44px tall (and 44px wide without a label), with the
 * hover tint, the keyboard focus ring and the disabled opacity.
 *
 * @summary Select an independent choice
 */
export function Checkbox(props: CheckboxProps): JSX.Element {
  const indeterminate = () => props.indeterminate ?? false;
  const filled = () => props.checked || indeterminate();
  return (
    <button
      class="clickable clickableTint rounded-sm flex-row items-center gap-3 min-h-11"
      classList={{
        'min-w-11 justify-center': props.label === undefined,
        'opacity-disabled cursor-not-allowed': props.disabled === true,
      }}
      {...dataAttrs({ component: 'Checkbox', ...props.dataSet })}
      type="button"
      role="checkbox"
      aria-checked={indeterminate() ? 'mixed' : props.checked}
      aria-label={props['aria-label']}
      disabled={props.disabled}
      onClick={() => props.onToggle(indeterminate() ? true : !props.checked)}
    >
      <span
        class="checkboxBox flex size-5 shrink-0 rounded-sm items-center justify-center"
        data-filled={filled() ? 'true' : 'false'}
      >
        <Show when={filled()}>
          <CheckboxGlyph indeterminate={indeterminate()} />
        </Show>
      </span>
      <Show when={props.label !== undefined}>
        <p class="text textBody">{props.label}</p>
      </Show>
    </button>
  );
}
