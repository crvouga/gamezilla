/** @jsxImportSource solid-js */
/**
 * Smart chess board: owns {@link ChessGame} (chess.js) and maps dests into the
 * controlled {@link ChessBoard} view. Puzzle / demo ergonomics (fen + onMove).
 */

import { useTimers } from '@pkgs/clock/solid';
import { useTheme } from '@pkgs/ui';
import type { JSX } from 'solid-js';

import { createBoardController } from './chess-board-controller';
import { ChessBoardView } from './chess-board-view';
import type { SmartChessBoardProps } from './smart-chess-board-types';

export type { SmartChessBoardProps } from './smart-chess-board-types';

export function SmartChessBoard(props: SmartChessBoardProps): JSX.Element {
  const themeCtx = useTheme();
  const timers = useTimers();
  const ctrl = createBoardController({
    props,
    colorScheme: () => themeCtx.colorScheme(),
    timers,
  });
  return <ChessBoardView props={props} ctrl={ctrl} />;
}
