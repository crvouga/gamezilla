/** @jsxImportSource solid-js */
/** ARIA live region for spoken moves and position descriptions. */

import type { Accessor, JSX } from 'solid-js';

import styles from '../chess-board/chess-board.module.css';

export function ChessBoardLiveRegion(props: {
  readonly testId: string;
  readonly message: Accessor<string>;
}): JSX.Element {
  return (
    <div
      class={styles['liveRegion']}
      data-testid={props.testId}
      aria-live="polite"
      aria-atomic="true"
      role="status"
    >
      {props.message()}
    </div>
  );
}
