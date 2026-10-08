import { dataAttrs } from '@pkgs/ui-root-shared/component-id';
import type { JSX } from 'solid-js';
import styles from './game-ui.module.css';

/** The game supplies the interactive surface; the arena owns its frame. */
export function GameBoardStage(props: { children: JSX.Element }): JSX.Element {
  return (
    <div
      class={styles['board']}
      {...dataAttrs({ component: 'GameBoardStage' })}
    >
      {props.children}
    </div>
  );
}
