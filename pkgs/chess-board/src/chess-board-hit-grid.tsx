/** @jsxImportSource solid-js */
/**
 * Invisible 8×8 button grid for hit-testing / focus / test ids. SVG layers
 * sit underneath with `pointer-events: none`.
 */

import { indexFromSquare } from '@pkgs/chess-board-core/geometry';
import { chessBoardSquareTestId } from '@pkgs/chess-board-core/probe';
import type {
  FileChar,
  PieceColor,
  Position,
  RankChar,
  Square,
} from '@pkgs/chess-board-core/types';
import { Box } from '@pkgs/ui';
import { For, type JSX } from 'solid-js';

import styles from './chess-board.module.css';

const FILES: readonly FileChar[] = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS: readonly RankChar[] = ['1', '2', '3', '4', '5', '6', '7', '8'];
export const BOARD_SQUARES: readonly Square[] = FILES.flatMap((f) =>
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion -- tsc widens the template to string; the assertion is load-bearing
  RANKS.map((r) => `${f}${r}` as Square)
);

export type ChessBoardHitGridProps = {
  readonly boardTestId: string;
  readonly cursor: Square;
  readonly position: Position;
  readonly turn: PieceColor;
  readonly legalTargets: readonly Square[];
};

export function ChessBoardHitGrid(props: ChessBoardHitGridProps): JSX.Element {
  return (
    <Box class={styles['grid']} sx={{ position: 'absolute', inset: 0 }}>
      <For each={[...BOARD_SQUARES]}>
        {(square) => {
          const own = () =>
            props.position[indexFromSquare(square)]?.color === props.turn;
          const target = () => props.legalTargets.includes(square);
          return (
            <button
              type="button"
              class={`${styles['square']}${own() ? ` ${styles['squareOwn']}` : ''}${target() ? ` ${styles['squareTarget']}` : ''}`}
              data-testid={chessBoardSquareTestId(props.boardTestId, square)}
              aria-label={square}
              tabIndex={props.cursor === square ? 0 : -1}
            />
          );
        }}
      </For>
    </Box>
  );
}
