/** @jsxImportSource solid-js */
/**
 * 8×8 grid of square buttons for focus, screen readers and test ids. It is
 * static: 64 buttons created once in a8 → h1 order, never reordered (black's
 * orientation changes only square transforms), with one native `focusin`
 * listener for all of them and a selector so moving the cursor touches only
 * the two buttons whose `tabIndex` changes. It takes no pointer events (the
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
import {
  type Accessor,
  createMemo,
  createSelector,
  For,
  type JSX,
} from 'solid-js';
import styles from '../chess-board/chess-board.module.css';

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
  const isCursor = createSelector(() => props.cursor);
  const isSelected = createSelector(() => props.selected());
  const targets = createMemo(() => new Set(props.legalTargets()));
  return (
    <div
      class={`box absolute inset-0 ${styles['grid']}`}
      on:focusin={(e) => {
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
          return (
            <button
              type="button"
              class={`${styles['cell']} ${styles['square']}`}
              style={{ transform: cellTransform(square, props.orientation) }}
              data-testid={chessBoardSquareTestId(props.boardTestId, square)}
              data-square={square}
              aria-label={`${label()}${legal() ? ', Legal destination' : ''}`}
              aria-pressed={isSelected(square)}
              tabIndex={isCursor(square) ? 0 : -1}
            />
          );
        }}
      </For>
    </div>
  );
}
