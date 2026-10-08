import { t } from '@lingui/core/macro';
import type { ComponentDataSet } from '@pkgs/ui-root-shared/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared/component-id';
import type { JSX } from 'solid-js';
import styles from './game-ui.module.css';

/** An inline lineup. Never covers the game or captures focus. */
export function GameVersus(props: {
  first: JSX.Element;
  second: JSX.Element;
  stackOnSmall?: boolean;
  dataSet?: ComponentDataSet;
}): JSX.Element {
  return (
    <div
      class={styles['versus']}
      data-stacked={props.stackOnSmall === true}
      {...dataAttrs({ component: 'GameVersus', ...props.dataSet })}
    >
      {props.first}
      <span class={styles['versusMark']} aria-label={t`Versus`}>
        VS
      </span>
      {props.second}
    </div>
  );
}
