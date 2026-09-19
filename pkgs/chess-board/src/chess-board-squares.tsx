/** @jsxImportSource solid-js */
/**
 * Square overlays (last move, selection, check, legal targets, cell highlights)
 * and optional edge coordinates. Base checker is {@link ChessBoardBackground}.
 */

import { indexFromSquare } from '@pkgs/chess-board-core/geometry';
import { chessBoardLayerTestId } from '@pkgs/chess-board-core/probe';
import type {
  BoardOrientation,
  CellHighlight,
  Move,
  Position,
  Square,
} from '@pkgs/chess-board-core/types';
import { For, type JSX, Show } from 'solid-js';

import { BOARD_UNITS, CELL_UNITS, squareOrigin } from './board-units';
import styles from './chess-board.module.css';
import { BOARD_SQUARES } from './chess-board-hit-grid';
import { SquareCell } from './chess-board-square-cell';
import { bumpChessBoardRender } from './dev/render-counts';
import { PaintToken } from './paint-token';

export type ChessBoardSquaresProps = {
  readonly boardTestId: string;
  readonly orientation: BoardOrientation;
  readonly position: Position;
  readonly lastMove: Move | null;
  readonly selected: Square | null;
  readonly legalTargets: readonly Square[];
  readonly cellHighlights: Partial<Record<Square, CellHighlight>> | undefined;
  readonly showCoordinates: boolean;
  readonly highlightLastMove: boolean;
  readonly highlightLegalMoves: boolean;
  readonly checkSquare: Square | null;
  readonly premoveFrom: Square | null;
  readonly premoveTo: Square | null;
};

function LegalMarker(props: {
  readonly square: Square;
  readonly orientation: BoardOrientation;
  readonly occupied: boolean;
}): JSX.Element {
  const origin = () => squareOrigin(props.square, props.orientation);
  const cx = () => origin().x + CELL_UNITS / 2;
  const cy = () => origin().y + CELL_UNITS / 2;
  return (
    <Show
      when={props.occupied}
      fallback={
        <circle
          cx={cx()}
          cy={cy()}
          r={CELL_UNITS * 0.15}
          fill="var(--chess-legal-dot)"
        >
          <PaintToken kind="dot" at={props.square} />
        </circle>
      }
    >
      <circle
        cx={cx()}
        cy={cy()}
        r={CELL_UNITS * 0.44}
        fill="none"
        stroke="var(--chess-legal-ring)"
        stroke-width={CELL_UNITS * 0.11}
      >
        <PaintToken kind="ring" at={props.square} />
      </circle>
    </Show>
  );
}

export function ChessBoardSquares(props: ChessBoardSquaresProps): JSX.Element {
  bumpChessBoardRender('squares');
  return (
    <svg
      class={`${styles['layer']} ${styles['svgLayer']}`}
      viewBox={`0 0 ${BOARD_UNITS} ${BOARD_UNITS}`}
      aria-hidden="true"
      data-testid={chessBoardLayerTestId(props.boardTestId, 'squares')}
    >
      <For each={[...BOARD_SQUARES]}>
        {(square) => (
          <SquareCell
            square={square}
            orientation={props.orientation}
            lastMove={props.lastMove}
            selected={props.selected}
            checkSquare={props.checkSquare}
            highlight={props.cellHighlights?.[square]}
            showCoordinates={props.showCoordinates}
            highlightLastMove={props.highlightLastMove}
            premoveFrom={props.premoveFrom}
            premoveTo={props.premoveTo}
          />
        )}
      </For>
      <Show when={props.highlightLegalMoves}>
        <For each={[...props.legalTargets]}>
          {(square) => (
            <LegalMarker
              square={square}
              orientation={props.orientation}
              occupied={props.position[indexFromSquare(square)] !== null}
            />
          )}
        </For>
      </Show>
    </svg>
  );
}
