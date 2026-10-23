import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { type JSX, Show } from 'solid-js';
import styles from './game-ui.module.css';

/**
 * The play surface and its seats. The game supplies the
 * interactive surface; the stage keeps it the largest thing on the screen,
 * with the far seat above and the near seat below.
 */
export function GameBoardStage(props: {
  /** The far seat (the opponent), above the board. */
  top?: JSX.Element;
  /** The near seat (the person holding the device), below the board. */
  bottom?: JSX.Element;
  children: JSX.Element;
  dataSet?: ComponentDataSet | undefined;
}): JSX.Element {
  return (
    <div
      class={styles['boardStage']}
      {...dataAttrs({ component: 'GameBoardStage', ...props.dataSet })}
    >
      <Show when={props.top}>{props.top}</Show>
      <div class={styles['board']}>{props.children}</div>
      <Show when={props.bottom}>{props.bottom}</Show>
    </div>
  );
}
