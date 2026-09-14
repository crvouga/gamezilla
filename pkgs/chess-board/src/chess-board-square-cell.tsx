/** @jsxImportSource solid-js */
/**
 * Single square overlays (selected, last-move, check, premove, cell highlight)
 * and optional edge coordinates. Base light/dark fills live on the background.
 */

import type {
  BoardOrientation,
  CellHighlight,
  Move,
  Square,
} from '@pkgs/chess-board-core/types';
import { type JSX, Show } from 'solid-js';

import { CELL_UNITS, squareOrigin } from './board-units';

export type SquareCellProps = {
  readonly square: Square;
  readonly orientation: BoardOrientation;
  readonly lastMove: Move | null;
  readonly selected: Square | null;
  readonly checkSquare: Square | null;
  readonly highlight: CellHighlight | undefined;
  readonly showCoordinates: boolean;
  readonly highlightLastMove: boolean;
  readonly premoveFrom: Square | null;
  readonly premoveTo: Square | null;
};

export type SquareOverlayInput = {
  readonly square: Square;
  readonly lastMove: Move | null;
  readonly selected: Square | null;
  readonly checkSquare: Square | null;
  readonly highlightLastMove: boolean;
  readonly premoveFrom: Square | null;
  readonly premoveTo: Square | null;
};

/** Overlay fill CSS color, or null when the checker background shows through. */
export function squareOverlayFill(cell: SquareOverlayInput): string | null {
  const {
    square,
    lastMove,
    selected,
    checkSquare,
    highlightLastMove,
    premoveFrom,
    premoveTo,
  } = cell;
  if (selected === square) return 'var(--chess-selected)';
  if (checkSquare === square) return 'var(--chess-check)';
  if (premoveFrom === square || premoveTo === square) {
    return 'var(--chess-last-move)';
  }
  if (
    highlightLastMove &&
    lastMove !== null &&
    (square === lastMove.from || square === lastMove.to)
  ) {
    return 'var(--chess-last-move)';
  }
  return null;
}

function SquareCoords(props: {
  readonly square: Square;
  readonly orientation: BoardOrientation;
  readonly x: number;
  readonly y: number;
}): JSX.Element {
  const file = () => props.square[0] ?? '';
  const rank = () => props.square[1] ?? '';
  const showFile = () =>
    props.orientation === 'white' ? rank() === '1' : rank() === '8';
  const showRank = () =>
    props.orientation === 'white' ? file() === 'a' : file() === 'h';
  return (
    <>
      <Show when={showFile()}>
        <text
          x={props.x + CELL_UNITS - 8}
          y={props.y + CELL_UNITS - 6}
          fill="var(--chess-coords)"
          font-size="14"
          text-anchor="end"
        >
          {file()}
        </text>
      </Show>
      <Show when={showRank()}>
        <text
          x={props.x + 6}
          y={props.y + 16}
          fill="var(--chess-coords)"
          font-size="14"
        >
          {rank()}
        </text>
      </Show>
    </>
  );
}

export function SquareCell(props: SquareCellProps): JSX.Element {
  const origin = () => squareOrigin(props.square, props.orientation);
  const x = () => origin().x;
  const y = () => origin().y;
  const h = () => props.highlight;
  const overlay = () =>
    squareOverlayFill({
      square: props.square,
      lastMove: props.lastMove,
      selected: props.selected,
      checkSquare: props.checkSquare,
      highlightLastMove: props.highlightLastMove,
      premoveFrom: props.premoveFrom,
      premoveTo: props.premoveTo,
    });
  return (
    <g>
      <Show when={overlay()}>
        {(fill) => (
          <rect
            x={x()}
            y={y()}
            width={CELL_UNITS}
            height={CELL_UNITS}
            fill={fill()}
          />
        )}
      </Show>
      <Show when={h()}>
        {(hl) => (
          <Show
            when={hl().ring === true}
            fallback={
              <rect
                x={x()}
                y={y()}
                width={CELL_UNITS}
                height={CELL_UNITS}
                fill={hl().color}
                opacity={hl().opacity ?? 0.35}
              />
            }
          >
            <rect
              x={x() + 3}
              y={y() + 3}
              width={CELL_UNITS - 6}
              height={CELL_UNITS - 6}
              fill="none"
              stroke={hl().color}
              stroke-width={4}
              opacity={hl().opacity ?? 0.85}
            />
          </Show>
        )}
      </Show>
      <Show when={props.showCoordinates}>
        <SquareCoords
          square={props.square}
          orientation={props.orientation}
          x={x()}
          y={y()}
        />
      </Show>
    </g>
  );
}
