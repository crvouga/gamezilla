/** @jsxImportSource solid-js */
/** Presentational shell for {@link ChessBoard}: host element + paint stack. */

import { indexFromSquare } from '@pkgs/chess-board-core-shared-ts/geometry';
import { pieceCode } from '@pkgs/chess-board-core-shared-ts/piece-code';
import {
  chessBoardLiveRegionTestId,
  DEFAULT_CHESS_BOARD_TEST_ID,
} from '@pkgs/chess-board-core-shared-ts/probe';
import { speakMove } from '@pkgs/chess-board-core-shared-ts/speak-move';
import type { Position, Square } from '@pkgs/chess-board-core-shared-ts/types';
import { boardThemeToCssVars } from '@pkgs/chess-board-root-shared-ts/board-theme';
import type { ChessBoardProps } from '@pkgs/chess-board-root-shared-ts/chess-board-types';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import {
  type Accessor,
  createEffect,
  createMemo,
  createSignal,
  type JSX,
  on,
} from 'solid-js';
import styles from '../chess-board/chess-board.module.css';
import { ChessBoardBackground } from '../chess-board-background/index';
import type { BoardController } from '../chess-board-controller';
import { ChessBoardFeedback } from '../chess-board-feedback/index';
import { ChessBoardHitGrid } from '../chess-board-hit-grid/index';
import { ChessBoardLiveRegion } from '../chess-board-live-region/index';
import { ChessBoardOverlays } from '../chess-board-overlays/index';
import type { PremoveGhost } from '../chess-board-pieces/index';
import { ChessBoardPieces } from '../chess-board-pieces/index';
import { ChessBoardShapes } from '../chess-board-shapes/index';
import { ChessBoardSquares, squareWashes } from '../chess-board-squares/index';

function findKingSquare(position: Position, color: 'w' | 'b'): Square | null {
  for (let i = 0; i < 64; i += 1) {
    const p = position[i];
    if (p?.type === 'k' && p.color === color) {
      return `${String.fromCharCode(97 + (i % 8))}${String.fromCharCode(49 + Math.floor(i / 8))}` as Square;
    }
  }
  return null;
}

function useSpokenLastMove(getCtrl: () => BoardController): Accessor<string> {
  const [liveMessage, setLiveMessage] = createSignal('');
  createEffect(
    on(
      () => getCtrl().model.game().lastMove,
      (move) => {
        if (move === null) {
          setLiveMessage('');
          return;
        }
        const g = getCtrl().model.game();
        const piece = g.position[indexFromSquare(move.to)];
        setLiveMessage(
          speakMove({
            move,
            piece: piece ?? null,
            inCheck: g.inCheck,
            isCheckmate: g.isCheckmate,
            isStalemate: g.isStalemate,
            isGameOver: g.isGameOver,
          })
        );
      }
    )
  );
  return liveMessage;
}

/** Square washes: selection (or the dragged piece's origin), check, premoves, last move. */
function useWashes(
  props: ChessBoardProps,
  ctrl: BoardController
): Accessor<readonly string[]> {
  return createMemo(() => {
    const g = ctrl.model.game();
    const ix = ctrl.model.interaction();
    return squareWashes({
      lastMove: g.lastMove,
      selected: ix.selected ?? ix.dragFrom,
      checkSquare: g.inCheck ? findKingSquare(g.position, g.turn) : null,
      highlightLastMove: props.highlightLastMove !== false,
      premoveSquares: ix.premves.flatMap((p) => [p.from, p.to]),
    });
  });
}

/** Faint piece on every queued premove's destination. */
function usePremoveGhosts(
  ctrl: BoardController
): Accessor<readonly PremoveGhost[]> {
  return createMemo(() => {
    const position = ctrl.model.game().position;
    return ctrl.model.interaction().premves.flatMap((p) => {
      const piece = position[indexFromSquare(p.from)];
      const code =
        piece === null || piece === undefined
          ? null
          : pieceCode(piece.color, piece.type);
      return code === null ? [] : [{ to: p.to, code }];
    });
  });
}

function BoardBody(args: {
  readonly props: ChessBoardProps;
  readonly ctrl: BoardController;
  readonly boardTestId: () => string;
}): JSX.Element {
  const game = () => args.ctrl.model.game();
  const ix = () => args.ctrl.model.interaction();
  const liveMessage = useSpokenLastMove(() => args.ctrl);
  return (
    <>
      <ChessBoardLiveRegion
        testId={chessBoardLiveRegionTestId(args.boardTestId())}
        message={liveMessage}
      />
      <ChessBoardBackground />
      <ChessBoardSquares
        boardTestId={args.boardTestId()}
        orientation={args.ctrl.orientation}
        position={() => game().position}
        washes={useWashes(args.props, args.ctrl)}
        legalTargets={() => ix().legalTargets}
        captureTargets={args.ctrl.model.captureTargets}
        cellHighlights={() => args.props.cellHighlights}
        showCoordinates={() => args.props.showCoordinates !== false}
        highlightLegalMoves={() => args.props.highlightLegalMoves !== false}
        setHover={args.ctrl.setHover}
      />
      <ChessBoardPieces
        boardTestId={args.boardTestId()}
        orientation={args.ctrl.orientation}
        rows={args.ctrl.model.rows}
        captureGhost={args.ctrl.model.captureGhost}
        premoveGhosts={usePremoveGhosts(args.ctrl)}
        animator={args.ctrl.animator}
        motion={args.ctrl.motion}
        replacement={() => game().lastMove === null}
        engaged={() => ix().selected !== null || ix().dragFrom !== null}
      />
      <ChessBoardShapes
        boardTestId={args.boardTestId()}
        orientation={args.ctrl.orientation}
        theme={args.ctrl.theme}
        shapes={args.ctrl.userShapes.shapes}
        arrows={args.ctrl.arrows}
        preview={args.ctrl.userShapes.preview}
      />
      <ChessBoardFeedback
        boardTestId={args.boardTestId()}
        orientation={args.ctrl.orientation()}
        theme={args.ctrl.theme()}
        cellFeedback={args.props.cellFeedback}
      />
      <ChessBoardHitGrid
        boardTestId={args.boardTestId()}
        orientation={args.ctrl.orientation()}
        onSquareFocus={(square) => args.ctrl.onSquareFocus(square)}
        cursor={args.ctrl.cursor()}
        position={() => game().position}
        selected={() => ix().selected ?? ix().dragFrom}
        legalTargets={() => ix().legalTargets}
        cellFeedback={() => args.props.cellFeedback}
      />
      <ChessBoardOverlays
        ctrl={args.ctrl}
        boardTestId={args.boardTestId}
        size={args.props.size}
      />
    </>
  );
}

/**
 * Colours whose pieces a press would pick up (`w`, `b`, `wb`), for the grab
 * cursor — one host attribute per move instead of a class per square.
 */
function grabColors(
  props: ChessBoardProps,
  ctrl: BoardController
): string | undefined {
  const ix = ctrl.model.interaction();
  if (!ix.interactive || ix.pendingPromotion !== null) return undefined;
  const turn = ctrl.model.game().turn;
  if (props.premoves !== true) return turn;
  const player = ctrl.orientation() === 'white' ? 'w' : 'b';
  return player === turn ? turn : `${turn}${player}`;
}

export function ChessBoardView(args: {
  readonly props: ChessBoardProps;
  readonly ctrl: BoardController;
}): JSX.Element {
  const boardTestId = () =>
    args.props.dataSet?.['testid'] ?? DEFAULT_CHESS_BOARD_TEST_ID;
  const themeVars = createMemo(() => boardThemeToCssVars(args.ctrl.theme()));
  const hostStyle = () => {
    // A fill-width board sizes by CSS: its measured width is not read here,
    // so resizing it never rebuilds the host style.
    const size =
      args.props.size === undefined
        ? { width: '100%' as const, 'aspect-ratio': 1 as const }
        : {
            width: `${args.ctrl.boardPx()}px`,
            height: `${args.ctrl.boardPx()}px`,
          };
    return {
      ...size,
      ...themeVars(),
      'border-color': 'var(--chess-border)',
      '--chess-move-ms': `${args.ctrl.motion().durationMs}ms`,
    };
  };
  return (
    // The board is a keyboard-managed game surface (`role="application"`):
    // arrow keys move the cursor and pointer events drive drags. jsx-a11y
    // classifies `application` as non-interactive, so the standard
    // WAI-ARIA pattern for a keyboard game board trips these two rules.
    // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <div
      class={`box border-2 border-solid ${styles['root']}`}
      classList={{ [styles['lite'] ?? '']: !args.ctrl.motion().effects }}
      style={hostStyle()}
      {...dataAttrs({
        component: 'ChessBoard',
        testid: boardTestId(),
        ...args.props.dataSet,
      })}
      data-grab={grabColors(args.props, args.ctrl)}
      ref={args.ctrl.setHost}
      onKeyDown={(e) => args.ctrl.onKeyDown(e)}
      // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex
      tabIndex={0}
      role="application"
      aria-label={`Chess board, ${args.ctrl.orientation()} facing you`}
    >
      <BoardBody
        props={args.props}
        ctrl={args.ctrl}
        boardTestId={boardTestId}
      />
    </div>
  );
}
