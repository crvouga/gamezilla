import type { ComponentDataSet } from '@pkgs/ui-root-shared/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared/component-id';
import type { JSX } from 'solid-js';
import styles from './game-ui.module.css';

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
      <span class={styles['meta']}>{props.label}</span>
      <strong class={styles['statValue']}>{props.value}</strong>
      <span class={styles['description']}>{props.detail}</span>
    </div>
  );
}
