/** @jsxImportSource solid-js */
/** Presentational shell for {@link ChessBoard}. */

import { DEFAULT_CHESS_BOARD_TEST_ID } from '@pkgs/chess-board-core/probe';
import type { Square } from '@pkgs/chess-board-core/types';
import { Box } from '@pkgs/ui';
import { createMemo, type JSX } from 'solid-js';
import styles from './chess-board.module.css';
import type { BoardController } from './chess-board-controller';
import { ChessBoardHitGrid } from './chess-board-hit-grid';
import { ChessBoardLayers } from './chess-board-layers';
import { ChessBoardOverlays } from './chess-board-overlays';
import type { ChessBoardProps } from './chess-board-types';

function findKingSquare(
  position: readonly ({ color: 'w' | 'b'; type: string } | null)[],
  color: 'w' | 'b'
): Square | null {
  for (let i = 0; i < 64; i += 1) {
    const p = position[i];
    if (p?.type === 'k' && p.color === color) {
      return `${String.fromCharCode(97 + (i % 8))}${String.fromCharCode(49 + Math.floor(i / 8))}` as Square;
    }
  }
  return null;
}

function BoardBody(args: {
  readonly props: ChessBoardProps;
  readonly ctrl: BoardController;
  readonly boardTestId: () => string;
}): JSX.Element {
  const checkSquare = createMemo(() => {
    const s = args.ctrl.model.game();
    return s.inCheck ? findKingSquare(s.position, s.turn) : null;
  });
  const game = () => args.ctrl.model.game();
  const ix = () => args.ctrl.model.interaction();
  return (
    <>
      <ChessBoardLayers
        orientation={args.ctrl.orientation()}
        theme={args.ctrl.theme()}
        position={game().position}
        lastMove={game().lastMove}
        selected={ix().selected}
        legalTargets={ix().legalTargets}
        checkSquare={checkSquare()}
        cellHighlights={args.props.cellHighlights}
        cellFeedback={args.props.cellFeedback}
        showCoordinates={args.props.showCoordinates !== false}
        highlightLastMove={args.props.highlightLastMove !== false}
        highlightLegalMoves={args.props.highlightLegalMoves !== false}
        rows={args.ctrl.model.rows}
        captureGhost={args.ctrl.model.captureGhost}
        snapSquare={args.ctrl.model.snapSquare}
        dragFrom={() => ix().dragFrom}
        dragAt={args.ctrl.dragAt}
        animated={args.ctrl.animated}
        arrows={args.ctrl.arrows()}
      />
      <ChessBoardHitGrid
        boardTestId={args.boardTestId()}
        cursor={args.ctrl.cursor()}
        position={game().position}
        turn={game().turn}
        legalTargets={ix().legalTargets}
      />
      <ChessBoardOverlays
        ctrl={args.ctrl}
        boardTestId={args.boardTestId}
        size={args.props.size}
      />
    </>
  );
}

export function ChessBoardView(args: {
  readonly props: ChessBoardProps;
  readonly ctrl: BoardController;
}): JSX.Element {
  const boardTestId = () =>
    args.props.dataSet?.['testid'] ?? DEFAULT_CHESS_BOARD_TEST_ID;
  const sizeSx = () =>
    args.props.size === undefined
      ? { width: '100%' as const, aspectRatio: 1 as const }
      : { width: args.props.size, height: args.props.size };
  return (
    <Box
      ref={args.ctrl.setHost}
      class={styles['root']}
      sx={{
        ...sizeSx(),
        position: 'relative',
        borderWidth: 2,
        borderStyle: 'solid',
        borderColor: args.ctrl.theme().border,
        overflow: 'hidden',
      }}
      dataSet={{
        component: 'ChessBoard',
        testid: boardTestId(),
        ...args.props.dataSet,
      }}
      onPointerDown={args.ctrl.onPointerDown}
      onPointerMove={args.ctrl.onPointerMove}
      onPointerUp={args.ctrl.onPointerUp}
      onPointerCancel={args.ctrl.onPointerCancel}
      onKeyDown={args.ctrl.onKeyDown}
      onContextMenu={args.ctrl.onContextMenu}
      tabIndex={0}
      role="application"
      aria-label="Chess board"
    >
      <BoardBody
        props={args.props}
        ctrl={args.ctrl}
        boardTestId={boardTestId}
      />
    </Box>
  );
}
