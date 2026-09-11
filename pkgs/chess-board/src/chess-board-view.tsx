/** @jsxImportSource solid-js */
/** Presentational shell for {@link ChessBoard}. */

import { speakMove } from '@pkgs/chess-board-core/a11y/speak-move';
import { indexFromSquare } from '@pkgs/chess-board-core/geometry';
import { pieceCode } from '@pkgs/chess-board-core/piece-svgs';
import { DEFAULT_CHESS_BOARD_TEST_ID } from '@pkgs/chess-board-core/probe';
import type { PieceCode, Square } from '@pkgs/chess-board-core/types';
import { dataAttrs } from '@pkgs/ui';
import {
  type Accessor,
  createEffect,
  createMemo,
  createSignal,
  type JSX,
  on,
} from 'solid-js';

import { boardThemeToCssVars } from './board-theme';
import styles from './chess-board.module.css';
import {
  type BoardController,
  MOVE_DURATION_MS,
} from './chess-board-controller';
import { ChessBoardHitGrid } from './chess-board-hit-grid';
import { ChessBoardLayers } from './chess-board-layers';
import { ChessBoardLiveRegion } from './chess-board-live-region';
import { ChessBoardOverlays } from './chess-board-overlays';
import type { SmartChessBoardProps } from './smart-chess-board-types';

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

function useSpokenLastMove(ctrl: BoardController): Accessor<string> {
  const [liveMessage, setLiveMessage] = createSignal('');
  createEffect(
    on(
      () => ctrl.model.game().lastMove,
      (move) => {
        if (move === null) return;
        const g = ctrl.model.game();
        const piece = g.position[indexFromSquare(move.to)];
        setLiveMessage(
          speakMove({
            move,
            piece: piece ?? null,
            inCheck: g.inCheck,
            isCheckmate: g.isCheckmate,
          })
        );
      }
    )
  );
  return liveMessage;
}

function premovePieceCode(ctrl: BoardController): PieceCode | null {
  const p = ctrl.model.interaction().premove;
  if (p === null) return null;
  const piece = ctrl.model.game().position[indexFromSquare(p.from)];
  if (piece === null || piece === undefined) return null;
  return pieceCode(piece.color, piece.type);
}

function BoardBody(args: {
  readonly props: SmartChessBoardProps;
  readonly ctrl: BoardController;
  readonly boardTestId: () => string;
}): JSX.Element {
  const checkSquare = createMemo(() => {
    const s = args.ctrl.model.game();
    return s.inCheck ? findKingSquare(s.position, s.turn) : null;
  });
  const game = () => args.ctrl.model.game();
  const ix = () => args.ctrl.model.interaction();
  const premove = () => ix().premove;
  const liveMessage = useSpokenLastMove(args.ctrl);
  return (
    <>
      <ChessBoardLiveRegion message={liveMessage} />
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
        dragGhost={args.ctrl.ghost}
        animated={args.ctrl.animated}
        arrows={args.ctrl.arrows()}
        shapes={args.ctrl.shapes()}
        premoveFrom={premove()?.from ?? null}
        premoveTo={premove()?.to ?? null}
        premoveCode={premovePieceCode(args.ctrl)}
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
  readonly props: SmartChessBoardProps;
  readonly ctrl: BoardController;
}): JSX.Element {
  const boardTestId = () =>
    args.props.dataSet?.['testid'] ?? DEFAULT_CHESS_BOARD_TEST_ID;
  const hostStyle = () => {
    const px = args.ctrl.boardPx();
    const size =
      args.props.size === undefined
        ? { width: '100%' as const, 'aspect-ratio': 1 as const }
        : {
            width: `${px}px`,
            height: `${px}px`,
          };
    return {
      ...size,
      ...boardThemeToCssVars(args.ctrl.theme()),
      'border-color': 'var(--chess-border)',
      '--chess-move-ms': `${MOVE_DURATION_MS}ms`,
    };
  };
  return (
    // The board is a keyboard-managed game surface (`role="application"`):
    // arrow keys move the cursor and pointer events drive drags. jsx-a11y
    // classifies `application` as non-interactive, so the standard
    // WAI-ARIA pattern for a keyboard game board trips these two rules.
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <div
      class={`box relative [border-width:2px] border-solid overflow-hidden ${styles['root']}`}
      style={hostStyle()}
      {...dataAttrs({
        component: 'ChessBoard',
        testid: boardTestId(),
        ...args.props.dataSet,
      })}
      ref={args.ctrl.setHost}
      onPointerDown={(e) => args.ctrl.onPointerDown(e)}
      onPointerMove={(e) => args.ctrl.onPointerMove(e)}
      onPointerUp={(e) => args.ctrl.onPointerUp(e)}
      onPointerCancel={() => args.ctrl.onPointerCancel()}
      onKeyDown={(e) => args.ctrl.onKeyDown(e)}
      onContextMenu={(e) => args.ctrl.onContextMenu(e)}
      // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
      tabIndex={0}
      role="application"
      aria-label="Chess board"
    >
      <BoardBody
        props={args.props}
        ctrl={args.ctrl}
        boardTestId={boardTestId}
      />
    </div>
  );
}
