/** @jsxImportSource solid-js */
/**
 * Single 8×8 checker plane using CSS custom properties (not 64 color rects).
 */

import type { JSX } from 'solid-js';

import styles from '../chess-board/chess-board.module.css';

export function ChessBoardBackground(): JSX.Element {
  return <div class={styles['background']} aria-hidden="true" />;
}
