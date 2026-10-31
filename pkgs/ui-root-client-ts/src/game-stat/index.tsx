import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { type JSX, Show } from 'solid-js';
import styles from '../game-ui.module.css';

/**
 * One number a person tracks: what it is, the number in the `stat` role, and
 * an optional footnote.
 */
export function GameStat(props: {
  label: JSX.Element;
  value: JSX.Element;
  detail?: JSX.Element | undefined;
  dataSet?: ComponentDataSet;
}): JSX.Element {
  return (
    <div
      class={styles['stat']}
      {...dataAttrs({ component: 'GameStat', ...props.dataSet })}
    >
      <span class={`${styles['meta']} text textCaption`}>{props.label}</span>
      <strong class="text textStat">{props.value}</strong>
      <Show when={props.detail}>
        <span class="text textFootnote">{props.detail}</span>
      </Show>
    </div>
  );
}
