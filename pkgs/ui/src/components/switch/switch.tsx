/** @jsxImportSource solid-js */
/**
 * `Switch` -- on/off toggle rendered as `<button role="switch">`.
 */

import { type JSX, Show } from 'solid-js';
import { type ComponentDataSet, dataAttrs } from '../../component-id';
import { colorVar } from '../../theme';
import { joinClass } from '../box/box';

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
const THUMB_TRAVEL = TRACK_WIDTH - THUMB - 4;

export function Switch(props: SwitchProps): JSX.Element {
  return (
    <div
      class="box flex-row items-center gap-2"
      {...dataAttrs({ component: 'Switch', ...props.dataSet })}
    >
      <button
        class="clickable min-h-[44px] justify-center"
        type="button"
        style={{
          width: `${TRACK_WIDTH}px`,
          height: `${TRACK_HEIGHT}px`,
          opacity: props.disabled ? 0.5 : 1,
        }}
        role="switch"
        aria-checked={props.value}
        aria-label={props['aria-label']}
        disabled={props.disabled}
        onClick={() => props.onValueChange(!props.value)}
      >
        <div
          class="box rounded-[9999px] justify-center [transition-property:background-color] [transition-duration:var(--ui-duration-fast)]"
          style={{
            'background-color': props.value
              ? colorVar('tint')
              : colorVar('outline'),
            width: `${TRACK_WIDTH}px`,
            height: `${TRACK_HEIGHT}px`,
          }}
        >
          <div
            class={joinClass(
              'box rounded-[9999px] bg-on-primary ml-0.5',
              '[transition-property:transform]',
              '[transition-duration:var(--ui-duration-fast)]'
            )}
            style={{
              width: `${THUMB}px`,
              height: `${THUMB}px`,
              transform: `translateX(${props.value ? THUMB_TRAVEL : 0}px)`,
            }}
          />
        </div>
      </button>
      <Show when={props.label !== undefined}>
        <p class="text">{props.label}</p>
      </Show>
    </div>
  );
}
