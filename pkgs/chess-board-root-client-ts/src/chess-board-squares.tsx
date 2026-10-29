/** @jsxImportSource solid-js */
/**
 * Square layer over the checker background: translucent washes (selection,
 * check, premoves, last move), legal-move hints, parent cell highlights and
 * the edge coordinates. Only squares that show something get a node — a
 * handful of one-cell boxes instead of 64 reactive cells — and a node is
 * keyed by what it paints, so a selection change only touches the squares
 * that changed.
 */

import { indexFromSquare } from '@pkgs/chess-board-core-shared-ts/geometry';
import { chessBoardLayerTestId } from '@pkgs/chess-board-core-shared-ts/probe';
import type {
  BoardOrientation,
  CellHighlight,
  Move,
  Position,
  Square,
} from '@pkgs/chess-board-core-shared-ts/types';
import {
  BOARD_VIEW_BOX,
  CELL_UNITS,
  cellTransform,
} from '@pkgs/chess-board-root-shared-ts/board-units';
import { bumpChessBoardRender } from '@pkgs/chess-board-root-shared-ts/render-counts';
import { type Accessor, createMemo, For, type JSX, Show } from 'solid-js';
import styles from './chess-board.module.css';
import { HtmlPaintToken } from './paint-token';

export type SquareWashKind = 'selected' | 'check' | 'premove' | 'last-move';

export type SquareWashInput = {
  readonly lastMove: Move | null;
  readonly selected: Square | null;
  readonly checkSquare: Square | null;
  readonly highlightLastMove: boolean;
  readonly premoveSquares: readonly Square[];
};

/**
 * The one wash each square shows (selection > check > premove > last move),
 * as `kind@square` keys in a stable order.
 */
export function squareWashes(input: SquareWashInput): readonly string[] {
  const washes = new Map<Square, SquareWashKind>();
  const put = (square: Square | null, kind: SquareWashKind): void => {
    if (square !== null && !washes.has(square)) washes.set(square, kind);
  };
  put(input.selected, 'selected');
  put(input.checkSquare, 'check');
  for (const square of input.premoveSquares) put(square, 'premove');
  if (input.highlightLastMove && input.lastMove !== null) {
    put(input.lastMove.from, 'last-move');
    put(input.lastMove.to, 'last-move');
  }
  return [...washes].map(([square, kind]) => `${kind}@${square}`);
}

export type ChessBoardSquaresProps = {
  readonly boardTestId: string;
  readonly orientation: Accessor<BoardOrientation>;
  readonly position: Accessor<Position>;
  readonly washes: Accessor<readonly string[]>;
  readonly legalTargets: Accessor<readonly Square[]>;
  readonly captureTargets: Accessor<readonly Square[]>;
  readonly cellHighlights: Accessor<
    Partial<Record<Square, CellHighlight>> | undefined
  >;
  readonly showCoordinates: Accessor<boolean>;
  readonly highlightLegalMoves: Accessor<boolean>;
  readonly setHover: (el: HTMLElement) => void;
};

function splitKey(key: string): { kind: string; square: Square } {
  const at = key.indexOf('@');
  return { kind: key.slice(0, at), square: key.slice(at + 1) as Square };
}

function Wash(props: {
  readonly washKey: string;
  readonly orientation: Accessor<BoardOrientation>;
}): JSX.Element {
  const wash = () => splitKey(props.washKey);
  return (
    <div
      class={`${styles['cell']} ${styles['wash']}`}
      data-kind={wash().kind}
      style={{ transform: cellTransform(wash().square, props.orientation()) }}
    >
      <HtmlPaintToken kind={wash().kind as SquareWashKind} at={wash().square} />
    </div>
  );
}

function Hint(props: {
  readonly hintKey: string;
  readonly orientation: Accessor<BoardOrientation>;
}): JSX.Element {
  const hint = () => splitKey(props.hintKey);
  const ring = () => hint().kind === 'ring';
  return (
    <div
      class={`${styles['cell']} ${ring() ? styles['hintCapture'] : styles['hint']}`}
      style={{ transform: cellTransform(hint().square, props.orientation()) }}
    >
      <HtmlPaintToken kind={ring() ? 'ring' : 'dot'} at={hint().square} />
    </div>
  );
}

function CellHighlightBox(props: {
  readonly square: Square;
  readonly highlight: CellHighlight;
  readonly orientation: Accessor<BoardOrientation>;
}): JSX.Element {
  const ring = () => props.highlight.ring === true;
  const style = (): JSX.CSSProperties => {
    const opacity = props.highlight.opacity ?? (ring() ? 0.85 : 0.35);
    const base: JSX.CSSProperties = {
      transform: cellTransform(props.square, props.orientation()),
      opacity: String(opacity),
    };
    if (ring()) {
      return {
        ...base,
        'box-shadow': `inset 0 0 0 4px ${props.highlight.color}`,
      };
    }
    return { ...base, 'background-color': props.highlight.color };
  };
  return (
    <div class={`${styles['cell']} ${styles['highlight']}`} style={style()}>
      <HtmlPaintToken
        kind="highlight"
        detail={ring() ? 'ring' : undefined}
        at={props.square}
      />
    </div>
  );
}

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;
const RANKS = ['1', '2', '3', '4', '5', '6', '7', '8'] as const;

/**
 * Edge labels inside the corner squares, chess.com-style: each label takes
 * the *other* square color so it reads on both.
 */
function Coordinates(props: {
  readonly orientation: BoardOrientation;
}): JSX.Element {
  const white = () => props.orientation === 'white';
  const files = () => (white() ? [...FILES] : [...FILES].reverse());
  const ranks = () => (white() ? [...RANKS].reverse() : [...RANKS]);
  // Display cell (col, row) is light when col + row is even.
  const ink = (col: number, row: number) =>
    (col + row) % 2 === 0 ? 'var(--chess-sq-dark)' : 'var(--chess-sq-light)';
  return (
    <svg
      class={`${styles['layer']} ${styles['svgLayer']} ${styles['coords']}`}
      viewBox={BOARD_VIEW_BOX}
    >
      {/* A file label's right inset absorbs a glyph's overhang past its
          advance (`f`) plus a device pixel of snapping at half scale on the
          smallest board, so the label never leaves its square. */}
      <For each={files()}>
        {(file, col) => (
          <text
            x={col() * CELL_UNITS + CELL_UNITS - 10}
            y={8 * CELL_UNITS - 20}
            fill={ink(col(), 7)}
            font-size="20"
            text-anchor="end"
          >
            {file}
          </text>
        )}
      </For>
      <For each={ranks()}>
        {(rank, row) => (
          <text
            x={5}
            y={row() * CELL_UNITS + 30}
            fill={ink(0, row())}
            font-size="20"
          >
            {rank}
          </text>
        )}
      </For>
    </svg>
  );
}

export function ChessBoardSquares(props: ChessBoardSquaresProps): JSX.Element {
  bumpChessBoardRender('squares');
  const hints = createMemo((): readonly string[] => {
    if (!props.highlightLegalMoves()) return [];
    const position = props.position();
    return props
      .legalTargets()
      .map((square) =>
        position[indexFromSquare(square)] === null &&
        !props.captureTargets().includes(square)
          ? `dot@${square}`
          : `ring@${square}`
      );
  });
  const highlights = createMemo(() =>
    Object.entries(props.cellHighlights() ?? {}).map(([square, h]) => ({
      square: square as Square,
      highlight: h,
    }))
  );
  return (
    <div
      class={`${styles['layer']} ${styles['squares']}`}
      aria-hidden="true"
      data-testid={chessBoardLayerTestId(props.boardTestId, 'squares')}
    >
      <For each={[...props.washes()]}>
        {(key) => <Wash washKey={key} orientation={props.orientation} />}
      </For>
      <For each={highlights()}>
        {(h) => (
          <CellHighlightBox
            square={h.square}
            highlight={h.highlight}
            orientation={props.orientation}
          />
        )}
      </For>
      <For each={[...hints()]}>
        {(key) => <Hint hintKey={key} orientation={props.orientation} />}
      </For>
      <div
        ref={(el) => props.setHover(el)}
        class={`${styles['cell']} ${styles['hover']}`}
      />
      <Show when={props.showCoordinates()}>
        <Coordinates orientation={props.orientation()} />
      </Show>
    </div>
  );
}
