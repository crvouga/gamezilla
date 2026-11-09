import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import type { JSX } from 'solid-js';
import styles from './word-tile-workspace.module.css';

/**
 * One seat's word workspace. On phones it reads top to bottom in source
 * order: notice, rack, actions, feedback, board. When there is room the board
 * grows, the rack sits under it beside the player's own seat, and the actions
 * and feedback form a column at its side.
 */
export function WordTileWorkspace(props: {
  notice?: JSX.Element;
  rack: JSX.Element;
  actions?: JSX.Element;
  feedback?: JSX.Element;
  board: JSX.Element;
}): JSX.Element {
  return (
    <div class={styles['workspace']}>
      <div
        class={styles['layout']}
        {...dataAttrs({ component: 'WordTileWorkspace' })}
      >
        <div class={styles['notice']}>{props.notice}</div>
        <div class={styles['rack']}>{props.rack}</div>
        <div class={styles['actions']}>{props.actions}</div>
        <div class={styles['feedback']}>{props.feedback}</div>
        <div class={styles['board']}>{props.board}</div>
      </div>
    </div>
  );
}
