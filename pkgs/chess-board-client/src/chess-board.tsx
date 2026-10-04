/** @jsxImportSource solid-js */
/**
 * Solid chess board. Owns the rules (chess.js via `ChessGame`) so a parent
 * only passes a FEN and listens for moves; see {@link ChessBoardProps}.
 *
 * Rendering is compositor-first: pieces are HTML boxes placed by
 * `transform`, slides are Web Animations on `transform`, and a drag writes
 * one style per pointer event with no framework work.
 */

import { useTimers } from '@pkgs/clock-client/solid';
import { useTheme } from '@pkgs/ui-client/theme-context';
import type { JSX } from 'solid-js';

import { createBoardController } from './chess-board-controller';
import type { ChessBoardProps } from '@pkgs/chess-board-shared/chess-board-types';
import { ChessBoardView } from './chess-board-view';

export function ChessBoard(props: ChessBoardProps): JSX.Element {
  const themeCtx = useTheme();
  const timers = useTimers();
  const ctrl = createBoardController({
    props,
    colorScheme: () => themeCtx.colorScheme(),
    timers,
  });
  return <ChessBoardView props={props} ctrl={ctrl} />;
}
