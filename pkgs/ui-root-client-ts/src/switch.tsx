/** @jsxImportSource solid-js */
/**
 * `Switch` -- on/off toggle rendered as `<button role="switch">`.
 *
 * A 48x28 track with a 24px thumb (`skin.css` `.switchTrack`): the blue
 * fill with an on-primary thumb when on, the muted track inside an outline
 * hairline with a secondary thumb when off, so the thumb always contrasts.
 * The thumb slides in 200ms; reduced motion snaps it. The button keeps a 44px-tall hit area around the track, shows the focus
 * ring on keyboard focus, and fades to the disabled opacity when disabled.
 */

import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { type JSX, Show } from 'solid-js';

export type SwitchProps = {
  value: boolean;
  onValueChange: (next: boolean) => void;
  /** Optional label displayed next to the switch. */
  label?: JSX.Element | undefined;
  disabled?: boolean | undefined;
  'aria-label'?: string | undefined;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
};

export function Switch(props: SwitchProps): JSX.Element {
  return (
    <div class="box flex-row items-center gap-3 shrink-0">
      {/* The identifiers name the control a person presses, so a driver that
          taps by test id toggles it (the wrapper would swallow the click). */}
      <button
        class="clickable flex-row items-center justify-center min-h-11 w-12 shrink-0 rounded-full"
        classList={{ 'opacity-disabled': props.disabled === true }}
        {...dataAttrs({ component: 'Switch', ...props.dataSet })}
        type="button"
        role="switch"
        aria-checked={props.value}
        aria-label={props['aria-label']}
        disabled={props.disabled}
        onClick={() => props.onValueChange(!props.value)}
      >
        <span
          class="switchTrack flex flex-row items-center w-12 h-7 rounded-full shrink-0"
          classList={{
            'bg-tint-active': props.value,
            'bg-surface-muted': !props.value,
          }}
          data-on={props.value ? 'true' : 'false'}
          aria-hidden="true"
        >
          <span
            class="switchThumb block size-6 rounded-full shrink-0"
            classList={{
              'bg-on-primary translate-x-5': props.value,
              'bg-text-secondary': !props.value,
            }}
          />
        </span>
      </button>
      <Show when={props.label !== undefined}>
        <p class="text textBody shrink-0">{props.label}</p>
      </Show>
    </div>
  );
}
