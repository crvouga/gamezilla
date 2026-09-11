/** @jsxImportSource solid-js */
/**
 * Controlled Solid chess board view. Position / fen and optional
 * {@link ChessBoardProps.movable} dests come from the parent. Does not own
 * game rules — use {@link SmartChessBoard} for the chess.js adapter.
 */

import { useTimers } from '@pkgs/clock/solid';
import { useTheme } from '@pkgs/ui';
import type { JSX } from 'solid-js';

import { createBoardController } from './chess-board-controller';
import type { ChessBoardProps } from './chess-board-types';
import { ChessBoardView } from './chess-board-view';
import type { SmartChessBoardProps } from './smart-chess-board-types';

export type { ChessBoardProps, ChessBoardMovable } from './chess-board-types';

/**
 * Controlled board host. Interaction is enabled only when `movable` is set;
 * otherwise the board paints fen/position as view-only. Move application is
 * still performed by the smart paint pipeline when `fen` is provided so piece
 * rows and last-move highlights stay consistent — the parent confirms via
 * fen updates (same optimistic pattern as {@link SmartChessBoard}).
 */
export function ChessBoard(props: ChessBoardProps): JSX.Element {
  const themeCtx = useTheme();
  const timers = useTimers();
  const asSmart = (): SmartChessBoardProps => ({
    fen: props.fen,
    orientation: props.orientation,
    size: props.size,
    interactive: props.viewOnly !== true && props.movable !== undefined,
    showCoordinates: props.showCoordinates,
    highlightLastMove: props.highlightLastMove,
    highlightLegalMoves: props.highlightLegalMoves,
    theme: props.theme,
    dataSet: props.dataSet,
    cellFeedback: props.cellFeedback,
    cellHighlights: props.cellHighlights,
    arrows: props.arrows,
    enableUserArrows: props.enableUserArrows,
    onUserArrowsChange: props.onUserArrowsChange,
    animations: animationEnabled(props.animation),
    premoves: props.premoves,
    autoPromoteQueen: props.autoPromoteQueen,
    onMove: props.onMove,
  });
  // Pass a reactive getter object so controller effects track prop changes.
  const reactiveSmart: SmartChessBoardProps = {
    get fen() {
      return asSmart().fen;
    },
    get orientation() {
      return asSmart().orientation;
    },
    get size() {
      return asSmart().size;
    },
    get interactive() {
      return asSmart().interactive;
    },
    get showCoordinates() {
      return asSmart().showCoordinates;
    },
    get highlightLastMove() {
      return asSmart().highlightLastMove;
    },
    get highlightLegalMoves() {
      return asSmart().highlightLegalMoves;
    },
    get theme() {
      return asSmart().theme;
    },
    get dataSet() {
      return asSmart().dataSet;
    },
    get cellFeedback() {
      return asSmart().cellFeedback;
    },
    get cellHighlights() {
      return asSmart().cellHighlights;
    },
    get arrows() {
      return asSmart().arrows;
    },
    get enableUserArrows() {
      return asSmart().enableUserArrows;
    },
    get onUserArrowsChange() {
      return asSmart().onUserArrowsChange;
    },
    get animations() {
      return asSmart().animations;
    },
    get premoves() {
      return asSmart().premoves;
    },
    get autoPromoteQueen() {
      return asSmart().autoPromoteQueen;
    },
    get onMove() {
      return asSmart().onMove;
    },
  };
  const ctrl = createBoardController({
    props: reactiveSmart,
    colorScheme: () => themeCtx.colorScheme(),
    timers,
  });
  return <ChessBoardView props={reactiveSmart} ctrl={ctrl} />;
}

function animationEnabled(
  animation: ChessBoardProps['animation']
): boolean | undefined {
  if (typeof animation === 'boolean') return animation;
  return animation?.enabled;
}
