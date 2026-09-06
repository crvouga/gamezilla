/** @jsxImportSource solid-js */
/**
 * Single square paint: fill, optional cell highlight, edge coordinates.
 */

import type {
  BoardOrientation,
  BoardTheme,
  CellHighlight,
  Move,
  Square,
} from '@pkgs/chess-board-core/types';
import { type JSX, Show } from 'solid-js';

import { CELL_UNITS, squareOrigin } from './board-units';

function isLightSquare(square: Square): boolean {
  const file = square.charCodeAt(0) - 97;
  const rank = square.charCodeAt(1) - 49;
  return (file + rank) % 2 === 1;
}

export type SquareCellProps = {
  readonly square: Square;
  readonly orientation: BoardOrientation;
  readonly theme: BoardTheme;
  readonly lastMove: Move | null;
  readonly selected: Square | null;
  readonly checkSquare: Square | null;
  readonly highlight: CellHighlight | undefined;
  readonly showCoordinates: boolean;
  readonly highlightLastMove: boolean;
};

export function squareFill(props: SquareCellProps): string {
  const { square, theme, lastMove, selected, checkSquare } = props;
  if (
    props.highlightLastMove &&
    lastMove !== null &&
    (square === lastMove.from || square === lastMove.to)
  ) {
    return theme.lastMove;
  }
  if (selected === square) return theme.selected;
  if (checkSquare === square) return theme.check;
  return isLightSquare(square) ? theme.lightSquare : theme.darkSquare;
}

function SquareCoords(props: {
  readonly square: Square;
  readonly orientation: BoardOrientation;
  readonly theme: BoardTheme;
  readonly x: number;
  readonly y: number;
}): JSX.Element {
  const file = props.square[0]!;
  const rank = props.square[1]!;
  const showFile = props.orientation === 'white' ? rank === '1' : rank === '8';
  const showRank = props.orientation === 'white' ? file === 'a' : file === 'h';
  return (
    <>
      <Show when={showFile}>
        <text
          x={props.x + CELL_UNITS - 8}
          y={props.y + CELL_UNITS - 6}
          fill={props.theme.coordinates}
          font-size="14"
          text-anchor="end"
        >
          {file}
        </text>
      </Show>
      <Show when={showRank}>
        <text
          x={props.x + 6}
          y={props.y + 16}
          fill={props.theme.coordinates}
          font-size="14"
        >
          {rank}
        </text>
      </Show>
    </>
  );
}

export function SquareCell(props: SquareCellProps): JSX.Element {
  const { x, y } = squareOrigin(props.square, props.orientation);
  const h = () => props.highlight;
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={CELL_UNITS}
        height={CELL_UNITS}
        fill={squareFill(props)}
      />
      <Show when={h()}>
        {(hl) => (
          <Show
            when={hl().ring === true}
            fallback={
              <rect
                x={x}
                y={y}
                width={CELL_UNITS}
                height={CELL_UNITS}
                fill={hl().color}
                opacity={hl().opacity ?? 0.35}
              />
            }
          >
            <rect
              x={x + 3}
              y={y + 3}
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
          theme={props.theme}
          x={x}
          y={y}
        />
      </Show>
    </g>
  );
}
