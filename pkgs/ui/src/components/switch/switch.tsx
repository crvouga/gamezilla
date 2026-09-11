/** @jsxImportSource solid-js */
/**
 * `Switch` -- on/off toggle rendered as `<button role="switch">`.
 */

import { type JSX, Show } from 'solid-js';
import { type ComponentDataSet, dataAttrs } from '../../component-id';

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

const TRACK_WIDTH = 44;
const TRACK_HEIGHT = 26;
const THUMB = 22;
const THUMB_INSET = 2;
const THUMB_TRAVEL = TRACK_WIDTH - THUMB - THUMB_INSET * 2;

export function Switch(props: SwitchProps): JSX.Element {
  return (
    <div
      class="box flex-row items-center gap-2 shrink-0"
      {...dataAttrs({ component: 'Switch', ...props.dataSet })}
    >
      <button
        class="clickable flex-row items-center justify-center min-h-[44px] bg-transparent shrink-0"
        type="button"
        style={{
          width: `${TRACK_WIDTH}px`,
          height: `${Math.max(TRACK_HEIGHT, 44)}px`,
          opacity: props.disabled ? 0.5 : 1,
        }}
        role="switch"
        aria-checked={props.value}
        aria-label={props['aria-label']}
        disabled={props.disabled}
        onClick={() => props.onValueChange(!props.value)}
      >
        <div
          class="flex flex-row items-center rounded-[9999px] shrink-0 self-center"
          classList={{
            'bg-tint': props.value,
            'bg-disabled': !props.value,
          }}
          style={{
            width: `${TRACK_WIDTH}px`,
            height: `${TRACK_HEIGHT}px`,
            padding: `${THUMB_INSET}px`,
            'box-sizing': 'border-box',
          }}
        >
          <div
            class="rounded-[9999px] shrink-0 self-center bg-on-primary"
            style={{
              width: `${THUMB}px`,
              height: `${THUMB}px`,
              transform: `translateX(${props.value ? THUMB_TRAVEL : 0}px)`,
            }}
          />
        </div>
      </button>
      <Show when={props.label !== undefined}>
        <p class="text textCaption shrink-0">{props.label}</p>
      </Show>
    </div>
  );
}
