/** @jsxImportSource @solidjs/web */

import type { JSX } from '@solidjs/web';
import { For } from 'solid-js';
import styles from './chess-board-frame.module.css';

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'] as const;

/**
 * Place ranks beside the board and files below it for a caller that requests
 * outside coordinates. Below 280px the board keeps its square-corner labels.
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
  /**
   * The side the ranks stand on: `start` (default), or `end`, where a wide
   * screen lines the board's start edge up with the screen's title.
   */
  readonly ranks?: 'start' | 'end' | undefined;
  readonly children: JSX.Element;
}): JSX.Element {
  const white = (): boolean => props.orientation === 'white';
  const files = () => (white() ? [...FILES] : [...FILES].reverse());
  const ranks = () => (white() ? [...RANKS] : [...RANKS].reverse());
  return (
    // Marks the labels' gutter beside the squares, so a stage's seats line
    // up with the squares rather than the labels (`GameBoardStage`).
    <div
      class={styles['host']}
      data-component="ChessBoardFrame"
      data-board-gutter={props.ranks ?? 'start'}
    >
      <div class={styles['frame']} data-ranks={props.ranks ?? 'start'}>
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
