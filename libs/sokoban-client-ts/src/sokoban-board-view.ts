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

export function sokobanTiles(
  board: SokobanBoard,
  pieces: Pieces,
  words: Words
): readonly TileBoardTile[] {
  return board.squares.map((square, index) => ({
    terrain: TERRAIN[square],
    marked: square === 'goal',
    label: squareLabel(board, pieces, index, words),
  }));
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
