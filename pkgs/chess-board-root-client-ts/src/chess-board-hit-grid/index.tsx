/** @jsxImportSource @solidjs/web */
/**
 * 8×8 grid of square buttons for focus, screen readers and test ids. It is
 * static: 64 buttons created once in a8 → h1 order, never reordered (black's
 * orientation changes only square transforms), with one `focusin` listener
 * for all of them and a memo per square so moving the cursor touches only
 * the two buttons whose `tabindex` changes. It takes no pointer events (the
 * board host handles those) and sits under the pieces, so a sliding piece
 * never has a layer above it to composite.
 */

import { indexFromSquare } from '@pkgs/chess-board-core-shared-ts/geometry';
import { chessBoardSquareTestId } from '@pkgs/chess-board-core-shared-ts/probe';
import type {
  BoardOrientation,
  CellFeedback,
  FileChar,
  PieceType,
  Position,
  RankChar,
  Square,
} from '@pkgs/chess-board-core-shared-ts/types';
import { cellTransform } from '@pkgs/chess-board-root-shared-ts/board-units';
import type { JSX } from '@solidjs/web';
import { type Accessor, createMemo, For } from 'solid-js';
import styles from '../chess-board/chess-board.module.css';
import { ChessGrid, ChessSquare } from './chess-grid';

const FILES: readonly FileChar[] = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS: readonly RankChar[] = ['8', '7', '6', '5', '4', '3', '2', '1'];

/** White's view, top-left first. */
const SQUARES_A8_TO_H1: readonly Square[] = RANKS.flatMap((r) =>
  FILES.map((f): Square => `${f}${r}`)
);

export type ChessBoardHitGridProps = {
  readonly boardTestId: string;
  readonly orientation: BoardOrientation;
  /** A square button took focus (tab, screen reader, roving focus). */
  readonly onSquareFocus: (square: Square) => void;
  readonly onSquareActivate: (square: Square) => void;
  readonly interactive: boolean;
  readonly cursor: Square;
  readonly position: Accessor<Position>;
  readonly selected: Accessor<Square | null>;
  readonly legalTargets: Accessor<readonly Square[]>;
  readonly cellFeedback: Accessor<
    Partial<Record<Square, CellFeedback>> | undefined
  >;
};

const PIECE_NAMES: Readonly<Record<PieceType, string>> = {
  p: 'pawn',
  n: 'knight',
  b: 'bishop',
  r: 'rook',
  q: 'queen',
  k: 'king',
};

function squareName(square: Square, position: Position): string {
  const piece = position[indexFromSquare(square)];
  return piece === null || piece === undefined
    ? `${square}, empty`
    : `${square}, ${piece.color === 'w' ? 'White' : 'Black'} ${PIECE_NAMES[piece.type]}`;
}

export function ChessBoardHitGrid(props: ChessBoardHitGridProps): JSX.Element {
  const targets = createMemo(() => new Set(props.legalTargets()));
  return (
    <ChessGrid
      aria-label="Chess board squares"
      disabled={!props.interactive}
      onSquareActivate={(square) => props.onSquareActivate(square)}
      class={`box absolute inset-0 ${styles['grid']}`}
      onFocusIn={(e) => {
        const square = (e.target as HTMLElement).dataset['square'];
        if (square !== undefined) props.onSquareFocus(square as Square);
      }}
    >
      <For each={SQUARES_A8_TO_H1}>
        {(square) => {
          const label = createMemo(() => {
            const name = squareName(square, props.position());
            const feedback = props.cellFeedback()?.[square]?.label;
            return feedback === undefined ? name : `${name}, ${feedback}`;
          });
          const legal = createMemo(() => targets().has(square));
          const isCursor = createMemo(() => props.cursor === square);
          const isSelected = createMemo(() => props.selected() === square);
          return (
            <ChessSquare
              value={square}
              class={`${styles['cell']} ${styles['square']}`}
              style={{ transform: cellTransform(square, props.orientation) }}
              data-testid={chessBoardSquareTestId(props.boardTestId, square)}
              data-square={square}
              aria-label={`${label()}${legal() ? ', Legal destination' : ''}`}
              aria-pressed={isSelected() ? 'true' : 'false'}
              tabindex={isCursor() ? 0 : -1}
            />
          );
        }}
      </For>
    </ChessGrid>
  );
}
