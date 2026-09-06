/** @jsxImportSource solid-js */
/**
 * Solid SVG/DOM chess board host. Interaction wiring:
 * {@link createBoardController}. Paint: {@link ChessBoardView}.
 */

import { useTimers } from '@pkgs/clock/solid';
import { useTheme } from '@pkgs/ui';
import type { JSX } from 'solid-js';

import { createBoardController } from './chess-board-controller';
import type { ChessBoardProps } from './chess-board-types';
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
