import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { type JSX, Show } from 'solid-js';
import styles from '../game-ui.module.css';
import { CircleAlertIcon } from '../icons';

const LOW_MARK_SIZE = 16;

/**
 * A seat's time, sized to sit at the far edge of a `GamePlayerBar`. The seat
 * already says whose clock it is, so the label is for a listener only; the
 * running clock takes the selected fill.
 *
 * A clock that is nearly used up is `low`: it takes the destructive fill and
 * shows a mark beside the time, so colour is never the only sign. Say so in
 * `ariaLabel` too.
 */
export function GameClock(props: {
  label: JSX.Element;
  value: JSX.Element;
  active?: boolean;
  /** Nearly used up. */
  low?: boolean;
  ariaLabel?: string;
  dataSet?: ComponentDataSet;
}): JSX.Element {
  return (
    <div
      class={styles['clock']}
      data-active={props.active === true}
      data-low={props.low === true}
      role="timer"
      aria-live="off"
      {...dataAttrs({ component: 'GameClock' })}
    >
      <span class="sr-only">{props.label}</span>
      <Show when={props.low === true}>
        <CircleAlertIcon size={LOW_MARK_SIZE} />
      </Show>
      <span
        class={`${styles['clockValue']} text textLabel textNumeral`}
        aria-label={props.ariaLabel}
        data-low={props.low === true}
        {...dataAttrs({ component: 'GameClockValue', ...props.dataSet })}
      >
        {props.value}
      </span>
    </div>
  );
}
