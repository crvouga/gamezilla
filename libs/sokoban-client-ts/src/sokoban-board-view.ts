import {
  type Cell,
  type SokobanBoard,
  type SokobanPosition,
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

export function sokobanTiles(
  board: SokobanBoard,
  pieces: Pieces,
  words: Words,
  shown: BoardWindow = {
    left: 0,
    top: 0,
    columns: board.width,
    rows: board.height,
  }
): readonly TileBoardTile[] {
  // One pass: where each piece stands, and each word once, not per square.
  const at = (cell: Cell): number => cell.y * board.width + cell.x;
  const worker = pieces.worker === null ? -1 : at(pieces.worker);
  const crates = new Set(pieces.crates.map(at));
  const workerWord = `, ${words.worker()}`;
  const crateWord = `, ${words.crate()}`;
  const squareWords = new Map<SokobanSquare, string>();
  const squareWord = (square: SokobanSquare): string => {
    const known = squareWords.get(square);
    if (known !== undefined) return known;
    const word = words.square(square);
    squareWords.set(square, word);
    return word;
  };
  // Only the squares on show: a close view builds 36, not the whole board.
  return Array.from({ length: shown.columns * shown.rows }, (_, at) => {
    const index =
      (shown.top + Math.floor(at / shown.columns)) * board.width +
      shown.left +
      (at % shown.columns);
    const square = board.squares[index] ?? 'outside';
    const piece =
      index === worker ? workerWord : crates.has(index) ? crateWord : '';
    return {
      terrain: TERRAIN[square],
      marked: square === 'goal',
      label: `${squareName(cellOf(board, index))}: ${squareWord(square)}${piece}`,
    };
  });
}

/**
 * The tiles to show, keeping each unchanged tile's previous object so a move
 * updates only the squares it changed, not every square on the board.
 */
export function keepUnchangedTiles(
  previous: readonly TileBoardTile[] | undefined,
  next: readonly TileBoardTile[]
): readonly TileBoardTile[] {
  if (previous === undefined) return next;
  return next.map((tile, index) => {
    const before = previous[index];
    return before !== undefined &&
      before.label === tile.label &&
      before.terrain === tile.terrain &&
      before.marked === tile.marked
      ? before
      : tile;
  });
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

export function positionPieces(position: SokobanPosition): Pieces {
  return { worker: position.worker, crates: position.crates };
}
