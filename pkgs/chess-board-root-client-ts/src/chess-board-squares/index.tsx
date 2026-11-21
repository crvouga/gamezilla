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
  BOARD_UNITS,
  BOARD_VIEW_BOX,
  CELL_UNITS,
  cellTransform,
} from '@pkgs/chess-board-root-shared-ts/board-units';
import { bumpChessBoardRender } from '@pkgs/chess-board-root-shared-ts/render-counts';
import { type Accessor, createMemo, For, type JSX, Show } from 'solid-js';
import styles from '../chess-board/chess-board.module.css';
import { HtmlPaintToken } from '../paint-token/index';

export type SquareWashKind = 'selected' | 'check' | 'premove' | 'last-move';

export type SquareWashInput = {
  readonly lastMove: Pick<Move, 'from' | 'to'> | null;
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
  /** The board's drawn width, which sizes its coordinate labels. */
  readonly boardPx: Accessor<number>;
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
 * Labels aim for {@link LABEL_TARGET_PX} on screen, so a desktop board (a
 * 67px square) reads them at about 11px. A smaller board's labels grow in
 * board units toward {@link LABEL_MAX_UNITS}, the most a square's outer
 * corner holds beside a piece's figure (84% of its square, centred), so a
 * phone-wide board's labels stay as large as that corner allows. Sizes are
 * board units (100 per square).
 */
const LABEL_TARGET_PX = 11;
/** The largest label any piece's figure leaves room for, on every edge square. */
const LABEL_MAX_UNITS = 20;
/** A huge board's labels stop shrinking here, so they stay in proportion. */
const LABEL_MIN_UNITS = 12;

/** Label size for a board drawn `boardPx` wide; an unmeasured board gets the largest. */
export function coordinateLabelUnits(boardPx: number): number {
  if (!(boardPx > 0)) return LABEL_MAX_UNITS;
  const units = (LABEL_TARGET_PX * BOARD_UNITS) / boardPx;
  return Math.round(
    Math.min(LABEL_MAX_UNITS, Math.max(LABEL_MIN_UNITS, units))
  );
}

/**
 * Where a label sits in its square, for a label `size` units tall: a file
 * label's right edge and baseline (room left under it for a `g`'s
 * descender), a rank label's left edge and baseline (one cap height down).
 * The insets keep a glyph's overhang and descent inside the square on
 * every platform.
 */
function labelPlacement(size: number) {
  return {
    fileInset: 8,
    fileBaselineInset: 10,
    rankInset: 5,
    rankBaseline: Math.round(size * 1.12),
  };
}

/**
 * Edge labels inside the corner squares, chess.com-style: on a light square
 * a deep walnut darker than the board's border, on a dark square a cream
 * lighter than the light square, so each label contrasts with the square it
 * sits on.
 */
function Coordinates(props: {
  readonly orientation: BoardOrientation;
  readonly boardPx: number;
}): JSX.Element {
  const white = () => props.orientation === 'white';
  const files = () => (white() ? [...FILES] : [...FILES].reverse());
  const ranks = () => (white() ? [...RANKS].reverse() : [...RANKS]);
  const size = () => coordinateLabelUnits(props.boardPx);
  const at = () => labelPlacement(size());
  // Display cell (col, row) is light when col + row is even.
  const ink = (col: number, row: number) =>
    (col + row) % 2 === 0 ? 'on-light' : 'on-dark';
  return (
    <svg
      class={`${styles['layer']} ${styles['svgLayer']} ${styles['coords']}`}
      viewBox={BOARD_VIEW_BOX}
    >
      {/* Each label hugs its square's outer corner, below and beside where
          a piece's figure reaches, so it never sits under a piece. A file
          label's right inset absorbs a glyph's overhang past its advance
          (`f`) plus a device pixel of snapping at half scale on the smallest
          board, so the label never leaves its square. */}
      <For each={files()}>
        {(file, col) => (
          <text
            x={col() * CELL_UNITS + CELL_UNITS - at().fileInset}
            y={8 * CELL_UNITS - at().fileBaselineInset}
            data-ink={ink(col(), 7)}
            font-size={String(size())}
            text-anchor="end"
          >
            {file}
          </text>
        )}
      </For>
      <For each={ranks()}>
        {(rank, row) => (
          <text
            x={at().rankInset}
            y={row() * CELL_UNITS + at().rankBaseline}
            data-ink={ink(0, row())}
            font-size={String(size())}
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
        <Coordinates
          orientation={props.orientation()}
          boardPx={props.boardPx()}
        />
      </Show>
    </div>
  );
}
