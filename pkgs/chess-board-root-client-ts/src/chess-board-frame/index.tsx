/** @jsxImportSource solid-js */

import { For, type JSX } from 'solid-js';
import styles from './chess-board-frame.module.css';

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'] as const;

/**
 * A fill-width chess board with its coordinates outside the squares: a
 * slim labelled frame, the ranks down its start edge and the files along
 * its foot, at a size a square's corner cannot hold. Every playing board
 * (280px and wider, a phone's or a desktop's, in a game or a puzzle) reads
 * its coordinates the same way; a thumbnail keeps the labels in the
 * squares' corners, and the frame takes no room. The board inside draws its
 * own coordinates as usual; the frame hides them while it shows its own.
 *
 * @example
 * ```tsx
 * <ChessBoardFrame orientation="white">
 *   <ChessBoard fen={fen} showCoordinates />
 * </ChessBoardFrame>
 * ```
 */
export function ChessBoardFrame(props: {
  readonly orientation: 'white' | 'black';
  readonly children: JSX.Element;
}): JSX.Element {
  const white = (): boolean => props.orientation === 'white';
  const files = () => (white() ? [...FILES] : [...FILES].reverse());
  const ranks = () => (white() ? [...RANKS] : [...RANKS].reverse());
  return (
    <div class={styles['host']} data-component="ChessBoardFrame">
      <div class={styles['frame']}>
        <div class={styles['ranks']} aria-hidden="true">
          <For each={ranks()}>
            {(rank) => <span class={styles['label']}>{rank}</span>}
          </For>
        </div>
        <div class={styles['board']}>{props.children}</div>
        <div class={styles['files']} aria-hidden="true">
          <For each={files()}>
            {(file) => <span class={styles['label']}>{file}</span>}
          </For>
        </div>
      </div>
    </div>
  );
}
