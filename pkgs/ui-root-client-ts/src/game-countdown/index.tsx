import { createTimedValue } from '@pkgs/clock-client-ts/solid';
import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { type JSX, Show } from 'solid-js';
import styles from '../game-ui.module.css';

/** Shows an existing deadline; never schedules or delays a game command. */
export function GameCountdown(props: {
  deadline: number | null;
  label: JSX.Element;
  pausedAt?: number | null;
  dataSet?: ComponentDataSet;
}): JSX.Element {
  const seconds = createTimedValue(
    (now) =>
      Math.max(
        0,
        Math.ceil(((props.deadline ?? now) - (props.pausedAt ?? now)) / 1000)
      ),
    (left, now) =>
      props.deadline !== null && props.pausedAt == null && left > 0
        ? now + (props.deadline - now) - (left - 1) * 1000
        : null
  );
  return (
    <Show when={props.deadline !== null}>
      <div
        class={styles['countdown']}
        {...dataAttrs({ component: 'GameCountdown', ...props.dataSet })}
      >
        <span class="text textCaption">{props.label}</span>
        <span class="text textLabel textNumeral" role="timer" aria-live="off">
          {seconds()}
        </span>
      </div>
    </Show>
  );
}
