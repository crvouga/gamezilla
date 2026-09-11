/** @jsxImportSource solid-js */
/**
 * SVG square fills + interaction markers (last move, selection, check, legal
 * targets, cell highlights) and optional edge coordinates.
 */

import { indexFromSquare } from '@pkgs/chess-board-core/geometry';
import type {
  BoardOrientation,
  BoardTheme,
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

export type ChessBoardSquaresProps = {
  readonly orientation: BoardOrientation;
  readonly theme: BoardTheme;
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
  readonly theme: BoardTheme;
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
          fill={props.theme.legalMoveDot}
        />
      }
    >
      <circle
        cx={cx()}
        cy={cy()}
        r={CELL_UNITS * 0.44}
        fill="none"
        stroke={props.theme.legalMoveCaptureRing}
        stroke-width={CELL_UNITS * 0.11}
      />
    </Show>
  );
}

export function ChessBoardSquares(props: ChessBoardSquaresProps): JSX.Element {
  return (
    <svg
      class={`${styles['layer']} ${styles['svgLayer']}`}
      viewBox={`0 0 ${BOARD_UNITS} ${BOARD_UNITS}`}
      aria-hidden="true"
    >
      <For each={[...BOARD_SQUARES]}>
        {(square) => (
          <SquareCell
            square={square}
            orientation={props.orientation}
            theme={props.theme}
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
              theme={props.theme}
              occupied={props.position[indexFromSquare(square)] !== null}
            />
          )}
        </For>
      </Show>
    </svg>
  );
}
