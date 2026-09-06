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
  const { props, ctrl } = args;
  const checkSquare = createMemo(() => {
    const s = ctrl.model.game();
    return s.inCheck ? findKingSquare(s.position, s.turn) : null;
  });
  const game = () => ctrl.model.game();
  const ix = () => ctrl.model.interaction();
  return (
    <>
      <ChessBoardLayers
        orientation={ctrl.orientation()}
        theme={ctrl.theme()}
        position={game().position}
        lastMove={game().lastMove}
        selected={ix().selected}
        legalTargets={ix().legalTargets}
        checkSquare={checkSquare()}
        cellHighlights={props.cellHighlights}
        cellFeedback={props.cellFeedback}
        showCoordinates={props.showCoordinates !== false}
        highlightLastMove={props.highlightLastMove !== false}
        highlightLegalMoves={props.highlightLegalMoves !== false}
        rows={ctrl.model.rows}
        captureGhost={ctrl.model.captureGhost}
        snapSquare={ctrl.model.snapSquare}
        dragFrom={() => ix().dragFrom}
        dragAt={ctrl.dragAt}
        animated={ctrl.animated}
        arrows={ctrl.arrows()}
      />
      <ChessBoardHitGrid
        boardTestId={args.boardTestId()}
        cursor={ctrl.cursor()}
        position={game().position}
        turn={game().turn}
        legalTargets={ix().legalTargets}
      />
      <ChessBoardOverlays
        ctrl={ctrl}
        boardTestId={args.boardTestId}
        size={props.size}
      />
    </>
  );
}

export function ChessBoardView(args: {
  readonly props: ChessBoardProps;
  readonly ctrl: BoardController;
}): JSX.Element {
  const { props, ctrl } = args;
  const boardTestId = () =>
    props.dataSet?.['testid'] ?? DEFAULT_CHESS_BOARD_TEST_ID;
  const sizeSx =
    props.size === undefined
      ? { width: '100%' as const, aspectRatio: 1 as const }
      : { width: props.size, height: props.size };
  return (
    <Box
      ref={ctrl.setHost}
      class={styles['root']}
      sx={{
        ...sizeSx,
        position: 'relative',
        borderWidth: 2,
        borderStyle: 'solid',
        borderColor: ctrl.theme().border,
        overflow: 'hidden',
      }}
      dataSet={{
        component: 'ChessBoard',
        testid: boardTestId(),
        ...props.dataSet,
      }}
      onPointerDown={ctrl.onPointerDown}
      onPointerMove={ctrl.onPointerMove}
      onPointerUp={ctrl.onPointerUp}
      onPointerCancel={ctrl.onPointerCancel}
      onKeyDown={ctrl.onKeyDown}
      onContextMenu={ctrl.onContextMenu}
      tabIndex={0}
      role="application"
      aria-label="Chess board"
    >
      <BoardBody props={props} ctrl={ctrl} boardTestId={boardTestId} />
    </Box>
  );
}
