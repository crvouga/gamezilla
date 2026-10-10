import type { ComponentDataSet } from '@pkgs/ui-root-shared/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared/component-id';
import type { JSX } from 'solid-js';
import styles from './game-ui.module.css';

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
      <span class={styles['meta']}>{props.label}</span>
      <span
        class={styles['clockValue']}
        aria-label={props.ariaLabel}
        {...dataAttrs({ component: 'GameClockValue', ...props.dataSet })}
      >
        {props.value}
      </span>
    </div>
  );
}
