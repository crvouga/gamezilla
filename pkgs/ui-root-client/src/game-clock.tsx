import type { ComponentDataSet } from '@pkgs/ui-root-shared/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared/component-id';
import type { JSX } from 'solid-js';
import styles from './game-ui.module.css';

/**
 * A seat's time, sized to sit at the far edge of a `GamePlayerBar`. The seat
 * already says whose clock it is, so the label is for a listener only; the
 * running clock takes the blue fill.
 */
export function GameClock(props: {
  label: JSX.Element;
  value: JSX.Element;
  active?: boolean;
  ariaLabel?: string;
  dataSet?: ComponentDataSet;
}): JSX.Element {
  return (
    <div
      class={styles['clock']}
      data-active={props.active === true}
      role="timer"
      aria-live="off"
      {...dataAttrs({ component: 'GameClock' })}
    >
      <span class="sr-only">{props.label}</span>
      <span
        class={`${styles['clockValue']} text textLabel textNumeral`}
        aria-label={props.ariaLabel}
        {...dataAttrs({ component: 'GameClockValue', ...props.dataSet })}
      >
        {props.value}
      </span>
    </div>
  );
}
