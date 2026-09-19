/** @jsxImportSource solid-js */
/**
 * Invisible 8×8 button grid for hit-testing / focus / test ids. SVG layers
 * sit underneath with `pointer-events: none`. Buttons flow in *display*
 * order (top-left first for the orientation) so each sits over its square;
 * the cursor square holds the roving focus.
 */

import { indexFromSquare } from '@pkgs/chess-board-core/geometry';
import { chessBoardSquareTestId } from '@pkgs/chess-board-core/probe';
import type {
  BoardOrientation,
  FileChar,
  PieceColor,
  Position,
  RankChar,
  Square,
} from '@pkgs/chess-board-core/types';
import { For, type JSX } from 'solid-js';

import styles from './chess-board.module.css';

const FILES: readonly FileChar[] = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS: readonly RankChar[] = ['1', '2', '3', '4', '5', '6', '7', '8'];
export const BOARD_SQUARES: readonly Square[] = FILES.flatMap((f) =>
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion -- tsc widens the template to string; the assertion is load-bearing
  RANKS.map((r) => `${f}${r}` as Square)
);

/** Squares top-left → bottom-right as painted for `orientation`. */
function displaySquares(orientation: BoardOrientation): readonly Square[] {
  const files = orientation === 'white' ? FILES : [...FILES].reverse();
  const ranks = orientation === 'white' ? [...RANKS].reverse() : RANKS;
  return ranks.flatMap((r) => files.map((f): Square => `${f}${r}`));
}

const DISPLAY_SQUARES: Readonly<Record<BoardOrientation, readonly Square[]>> = {
  white: displaySquares('white'),
  black: displaySquares('black'),
};

export type ChessBoardHitGridProps = {
  readonly boardTestId: string;
  readonly orientation: BoardOrientation;
  /** A square button took focus (tab, screen reader, roving focus). */
  readonly onSquareFocus: (square: Square) => void;
  readonly cursor: Square;
  readonly position: Position;
  readonly turn: PieceColor;
  readonly legalTargets: readonly Square[];
};

export function ChessBoardHitGrid(props: ChessBoardHitGridProps): JSX.Element {
  return (
    <div class={`box absolute inset-[0] ${styles['grid']}`}>
      <For each={[...DISPLAY_SQUARES[props.orientation]]}>
        {(square) => {
          const own = () =>
            props.position[indexFromSquare(square)]?.color === props.turn;
          const target = () => props.legalTargets.includes(square);
          return (
            <button
              type="button"
              class={`${styles['square']}${own() ? ` ${styles['squareOwn']}` : ''}${target() ? ` ${styles['squareTarget']}` : ''}`}
              data-testid={chessBoardSquareTestId(props.boardTestId, square)}
              data-square={square}
              aria-label={square}
              tabIndex={props.cursor === square ? 0 : -1}
              onFocus={() => props.onSquareFocus(square)}
            />
          );
        }}
      </For>
    </div>
  );
}
