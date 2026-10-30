/** @jsxImportSource solid-js */

import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { createUniqueId, type JSX, Show } from 'solid-js';

export type SwitchProps = {
  /** Current on/off setting; the parent owns and updates this value. */
  value: boolean;
  /** Receives the next setting after activation. */
  onValueChange: (next: boolean) => void;
  /** Optional label displayed next to the switch. */
  label?: JSX.Element | undefined;
  /** Prevent changing an unavailable setting while keeping it visible. */
  disabled?: boolean | undefined;
  /** Accessible name when no visible label is supplied. */
  'aria-label'?: string | undefined;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
};

/**
 * Change an on/off setting immediately. Use Checkbox for a choice that is
 * submitted with a form.
 *
 * `Switch` -- on/off toggle rendered as `<button role="switch">`.
 *
 * A 48x28 track with a 24px thumb (`skin.css` `.switchTrack`): on is the
 * soft blue (`tint-subtle` track, `primary-strong` edge and thumb), off is a
 * clear track inside the `outline` hairline with a secondary thumb, so the
 * thumb position, not only its color, says which. The thumb slides in
 * 200ms; reduced motion snaps it. The button keeps a 48x44 hit area around
 * the track, shows the focus ring on keyboard focus only, and fades to the
 * disabled opacity when disabled. `role="switch"` + `aria-checked`.
 *
 * @summary Change an on/off setting immediately
 */
export function Switch(props: SwitchProps): JSX.Element {
  const labelId = createUniqueId();
  return (
    <div class="box flex-row items-center gap-3 shrink-0">
      {/* The identifiers name the control a person presses, so a driver that
          taps by test id toggles it (the wrapper would swallow the click). */}
      <button
        class="clickable flex-row items-center justify-center min-h-11 w-12 shrink-0 rounded-full"
        classList={{
          'opacity-disabled cursor-not-allowed': props.disabled === true,
        }}
        {...dataAttrs({ component: 'Switch', ...props.dataSet })}
        type="button"
        role="switch"
        aria-checked={props.value}
        aria-label={props['aria-label']}
        aria-labelledby={
          props['aria-label'] === undefined && props.label !== undefined
            ? labelId
            : undefined
        }
        disabled={props.disabled}
        onClick={() => props.onValueChange(!props.value)}
      >
        <span
          class="switchTrack flex flex-row items-center w-12 h-7 rounded-full shrink-0"
          classList={{
            'bg-tint-subtle': props.value,
            'bg-transparent': !props.value,
          }}
          data-on={props.value ? 'true' : 'false'}
          aria-hidden="true"
        >
          <span
            class="switchThumb block size-6 rounded-full shrink-0"
            classList={{
              'bg-primary-strong translate-x-5': props.value,
              'bg-text-secondary': !props.value,
            }}
          />
        </span>
      </button>
      <Show when={props.label !== undefined}>
        <p id={labelId} class="text textBody shrink-0">
          {props.label}
        </p>
      </Show>
    </div>
  );
}
