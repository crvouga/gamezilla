import type { ComponentDataSet } from '@pkgs/ui-root-shared/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared/component-id';
import type { JSX } from 'solid-js';
import styles from './game-ui.module.css';

/** One number a person tracks: what it is, the number, and its footnote. */
export function GameStat(props: {
  label: JSX.Element;
  value: JSX.Element;
  detail: JSX.Element;
  dataSet?: ComponentDataSet;
}): JSX.Element {
  return (
    <div
      class={styles['stat']}
      {...dataAttrs({ component: 'GameStat', ...props.dataSet })}
    >
      <span class={`${styles['meta']} text textCaption`}>{props.label}</span>
      <strong class="text textSubtitle textNumeral">{props.value}</strong>
      <span class="text textFootnote">{props.detail}</span>
    </div>
  );
}
