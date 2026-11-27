import {
  type Cell,
  type SokobanBoard,
  type SokobanSquare,
  sameCell,
  squareName,
} from '@libs/sokoban-shared-ts/sokoban-types';
import type {
  TileBoardPiece,
  TileBoardTile,
} from '@pkgs/ui-root-client-ts/tile-board';
import type { useSokobanWords } from './use-sokoban-words';

type Words = ReturnType<typeof useSokobanWords>;
/** Pieces stand where the position says, or where the board starts them. */
type Pieces = {
  readonly worker: Cell | null;
  readonly crates: readonly Cell[];
};

const TERRAIN: Readonly<Record<SokobanSquare, TileBoardTile['terrain']>> = {
  wall: 'solid',
  floor: 'open',
  goal: 'open',
  outside: 'none',
};

export function cellOf(board: SokobanBoard, index: number): Cell {
  return { x: index % board.width, y: Math.floor(index / board.width) };
}

/** `C1: goal, crate` — every tile says where it is and what stands on it. */
export function squareLabel(
  board: SokobanBoard,
  pieces: Pieces,
  index: number,
  words: Words
): string {
  const cell = cellOf(board, index);
  const square = board.squares[index] ?? 'outside';
  const piece =
    pieces.worker !== null && sameCell(pieces.worker, cell)
      ? `, ${words.worker()}`
      : pieces.crates.some((crate) => sameCell(crate, cell))
        ? `, ${words.crate()}`
        : '';
  return `${squareName(cell)}: ${words.square(square)}${piece}`;
}

/** The part of a board on show: its first column and row, and its size. */
export type BoardWindow = {
  readonly left: number;
  readonly top: number;
  readonly columns: number;
  readonly rows: number;
};

export function indexInWindow(cell: Cell, shown: BoardWindow): number {
  const x = cell.x - shown.left;
  const y = cell.y - shown.top;
  if (x < 0 || y < 0 || x >= shown.columns || y >= shown.rows) return -1;
  return y * shown.columns + x;
}

/** Terrain and translated square names stay valid until the view, board or locale changes. */
export function createSokobanTiles(
  board: SokobanBoard,
  words: Words,
  shown: BoardWindow = {
    left: 0,
    top: 0,
    columns: board.width,
    rows: board.height,
  }
) {
  const squareWords = new Map<SokobanSquare, string>();
  const squareWord = (square: SokobanSquare): string => {
    const known = squareWords.get(square);
    if (known !== undefined) return known;
    const word = words.square(square);
    squareWords.set(square, word);
    return word;
  };
  // Only the squares on show: a close view builds 36, not the whole board.
  const terrain = Array.from(
    { length: shown.columns * shown.rows },
    (_, at) => {
      const index =
        (shown.top + Math.floor(at / shown.columns)) * board.width +
        shown.left +
        (at % shown.columns);
      const square = board.squares[index] ?? 'outside';
      return {
        terrain: TERRAIN[square],
        marked: square === 'goal',
        label: `${squareName(cellOf(board, index))}: ${squareWord(square)}`,
      };
    }
  );
  const place = (word: string) => {
    const occupied: TileBoardTile[] = [];
    return (tiles: TileBoardTile[], cell: Cell) => {
      const index = indexInWindow(cell, shown);
      const base = terrain[index];
      if (!base) return;
      occupied[index] ??= { ...base, label: `${base.label}, ${word}` };
      tiles[index] = occupied[index];
    };
  };
  const placeWorker = place(words.worker());
  const placeCrate = place(words.crate());
  return (pieces: Pieces): readonly TileBoardTile[] => {
    const tiles = terrain.slice();
    for (const crate of pieces.crates) placeCrate(tiles, crate);
    if (pieces.worker) placeWorker(tiles, pieces.worker);
    return tiles;
  };
}

/** Crates keep their array position, so each glides as it is pushed. */
export function sokobanPieces(
  board: SokobanBoard,
  pieces: Pieces
): readonly TileBoardPiece[] {
  const onGoal = (cell: Cell): boolean =>
    board.squares[cell.y * board.width + cell.x] === 'goal';
  return [
    ...pieces.crates.map((crate, index) => ({
      id: `crate-${index}`,
      column: crate.x,
      row: crate.y,
      glyph: onGoal(crate) ? '▣' : '▢',
      tone: onGoal(crate) ? ('settled' as const) : ('object' as const),
    })),
    ...(pieces.worker === null
      ? []
      : [
          {
            id: 'worker',
            column: pieces.worker.x,
            row: pieces.worker.y,
            glyph: '☻',
            tone: 'actor' as const,
          },
        ]),
  ];
}

/**
 * Where a window of `size` squares starts along one axis so it follows the
 * worker: it stays put while the worker is at least one square from its
 * edge, and centres on the worker only when the worker nears an edge. A
 * step inside the window then changes two squares, not all of them, and
 * the view does not slide under the player on every move.
 */
export function followAxis(
  previous: number | undefined,
  size: number,
  extent: number,
  worker: number
): number {
  const clamp = (start: number) => Math.max(0, Math.min(extent - size, start));
  const centred = clamp(worker - Math.floor(size / 2));
  if (previous === undefined) return centred;
  const start = clamp(previous);
  const nearStart = worker < start + 1 && start > 0;
  const nearEnd = worker > start + size - 2 && start < extent - size;
  const outside = worker < start || worker >= start + size;
  return outside || nearStart || nearEnd ? centred : start;
}
