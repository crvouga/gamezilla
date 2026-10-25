import {
  decodeSokobanBoard,
  encodeSokobanBoard,
} from '@libs/sokoban-shared-ts/sokoban-definition';
import {
  applySokobanMove,
  initialSokobanPosition,
  sokobanComplete,
} from '@libs/sokoban-shared-ts/sokoban-position';
import {
  type Cell,
  SOKOBAN_DIRECTIONS,
  type SokobanBoard,
  type SokobanDirection,
  type SokobanPosition,
  type SokobanSquare,
} from '@libs/sokoban-shared-ts/sokoban-types';
import fc from 'fast-check';

/** The canonical definition text for literal rows. */
export function rowsText(...rows: readonly string[]): string {
  return JSON.stringify({ format: 1, rows });
}

export function boardOf(...rows: readonly string[]): SokobanBoard {
  const board = decodeSokobanBoard(rowsText(...rows));
  if (!board.valid) throw new Error(`fixture board refused: ${rows}`);
  return board.value;
}

export function definitionBoard(definition: string): SokobanBoard {
  const board = decodeSokobanBoard(definition);
  if (!board.valid) throw new Error('fixture definition refused');
  return board.value;
}

export function startOf(board: SokobanBoard): SokobanPosition {
  const start = initialSokobanPosition(board);
  if (!start.valid) throw new Error('fixture board is not playable');
  return start.value;
}

export function cellAt(index: number, width: number): Cell {
  return { x: index % width, y: Math.floor(index / width) };
}

/** Rebuild through the codec so crates take their canonical row-major order. */
function canonical(board: SokobanBoard): SokobanBoard {
  const decoded = decodeSokobanBoard(encodeSokobanBoard(board));
  if (!decoded.valid) throw new Error('generated board refused');
  return decoded.value;
}

const terrain = fc.constantFrom<SokobanSquare>(
  'floor',
  'floor',
  'floor',
  'goal',
  'wall',
  'outside'
);
const piece = fc.constantFrom('none', 'none', 'crate', 'worker');

/** Any draft board: any terrain, at most one worker, any crate and goal counts. */
export function draftBoardArb(maxSize = 5): fc.Arbitrary<SokobanBoard> {
  return fc
    .record({
      width: fc.integer({ min: 1, max: maxSize }),
      height: fc.integer({ min: 1, max: maxSize }),
    })
    .chain(({ width, height }) =>
      fc
        .record({
          squares: fc.array(terrain, {
            minLength: width * height,
            maxLength: width * height,
          }),
          pieces: fc.array(piece, {
            minLength: width * height,
            maxLength: width * height,
          }),
        })
        .map(({ squares, pieces }) => {
          let worker: Cell | null = null;
          const crates: Cell[] = [];
          squares.forEach((square, index) => {
            if (square !== 'floor' && square !== 'goal') return;
            if (pieces[index] === 'crate') crates.push(cellAt(index, width));
            if (pieces[index] === 'worker' && worker === null)
              worker = cellAt(index, width);
          });
          return canonical({ width, height, squares, worker, crates });
        })
    );
}

function takeDistinct<T>(pool: T[], picks: readonly number[]): T[] {
  const taken: T[] = [];
  for (const pick of picks) {
    if (pool.length === 0) break;
    const [entry] = pool.splice(pick % pool.length, 1);
    if (entry !== undefined) taken.push(entry);
  }
  return taken;
}

type PuzzleShape = {
  readonly width: number;
  readonly height: number;
  readonly squares: SokobanSquare[];
  readonly picks: readonly number[];
  readonly crateCount: number;
};

function playableBoard(shape: PuzzleShape): SokobanBoard {
  const { width, height, picks } = shape;
  const squares = [...shape.squares];
  squares[0] = 'floor';
  squares[1] = 'floor';
  const standable = squares.flatMap((square, index) =>
    square === 'floor' ? [index] : []
  );
  const [workerIndex = 0] = takeDistinct([...standable], picks.slice(0, 1));
  const free = standable.filter((index) => index !== workerIndex);
  const crates = takeDistinct(free, picks.slice(1, 1 + shape.crateCount));
  const goals = takeDistinct([...standable], picks.slice(1 + shape.crateCount));
  for (const goal of goals.slice(0, crates.length)) squares[goal] = 'goal';
  return canonical({
    width,
    height,
    squares,
    worker: cellAt(workerIndex, width),
    crates: crates.map((index) => cellAt(index, width)),
  });
}

/** Mostly floor, so generated walks push crates rather than bump into walls. */
const puzzleTerrain = fc.oneof(
  { weight: 6, arbitrary: fc.constant<SokobanSquare>('floor') },
  { weight: 1, arbitrary: fc.constant<SokobanSquare>('wall') },
  { weight: 1, arbitrary: fc.constant<SokobanSquare>('outside') }
);

/** Playable boards: one worker, at least one crate and as many goals as crates. */
export function puzzleBoardArb(options: {
  readonly maxWidth: number;
  readonly maxHeight: number;
  readonly maxCrates: number;
  readonly minSize?: number;
}): fc.Arbitrary<SokobanBoard> {
  return fc
    .record({
      width: fc.integer({ min: options.minSize ?? 2, max: options.maxWidth }),
      height: fc.integer({ min: options.minSize ?? 1, max: options.maxHeight }),
      crateCount: fc.integer({ min: 1, max: options.maxCrates }),
    })
    .chain(({ width, height, crateCount }) =>
      fc
        .record({
          squares: fc.array(puzzleTerrain, {
            minLength: width * height,
            maxLength: width * height,
          }),
          picks: fc.array(fc.nat(), {
            minLength: 1 + 2 * crateCount,
            maxLength: 1 + 2 * crateCount,
          }),
        })
        .map(({ squares, picks }) =>
          playableBoard({ width, height, squares, picks, crateCount })
        )
    );
}

export const directionArb = fc.constantFrom(...SOKOBAN_DIRECTIONS);

export function directionsArb(
  maxLength = 30
): fc.Arbitrary<SokobanDirection[]> {
  return fc.array(directionArb, {
    minLength: Math.floor(maxLength / 2),
    maxLength,
  });
}

/** Every square the worker and crates can reach, with the fewest moves to completion. */
export function enumeratePositions(board: SokobanBoard): {
  readonly reachable: number;
  readonly fewestMoves: number | null;
} {
  const keyOf = (position: SokobanPosition): string =>
    JSON.stringify([
      position.worker,
      [...position.crates].sort((a, b) => a.y - b.y || a.x - b.x),
    ]);
  let frontier = [startOf(board)];
  const seen = new Set(frontier.map(keyOf));
  let fewestMoves: number | null = sokobanComplete(board, frontier[0]!)
    ? 0
    : null;
  for (let depth = 1; frontier.length > 0; depth += 1) {
    const next: SokobanPosition[] = [];
    for (const position of frontier)
      for (const direction of SOKOBAN_DIRECTIONS) {
        const moved = applySokobanMove(board, position, direction);
        if (!moved.valid || seen.has(keyOf(moved.value))) continue;
        seen.add(keyOf(moved.value));
        next.push(moved.value);
        if (fewestMoves === null && sokobanComplete(board, moved.value))
          fewestMoves = depth;
      }
    frontier = next;
  }
  return { reachable: seen.size, fewestMoves };
}

/** A 20 by 20 room: the worker at A1, ten crates in column F and ten goals in column P. */
export const LARGEST_ROWS = Array.from({ length: 20 }, (_, y) =>
  y >= 1 && y <= 10
    ? `${' '.repeat(5)}$${' '.repeat(9)}.${' '.repeat(4)}`
    : `${y === 0 ? '@' : ' '}${' '.repeat(19)}`
);

const OPPOSITE: Readonly<Record<SokobanDirection, SokobanDirection>> = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
};

function shift(cell: Cell, direction: SokobanDirection, by = 1): Cell {
  const dx = direction === 'left' ? -1 : direction === 'right' ? 1 : 0;
  const dy = direction === 'up' ? -1 : direction === 'down' ? 1 : 0;
  return { x: cell.x + dx * by, y: cell.y + dy * by };
}

type Pull = { readonly direction: SokobanDirection; readonly pull: boolean };

type Walk = { worker: Cell; crates: Cell[] };

function standableFree(solved: SokobanBoard, walk: Walk, cell: Cell): boolean {
  const inside =
    cell.x >= 0 &&
    cell.y >= 0 &&
    cell.x < solved.width &&
    cell.y < solved.height;
  const square = solved.squares[cell.y * solved.width + cell.x];
  return (
    inside &&
    (square === 'floor' || square === 'goal') &&
    !walk.crates.some((crate) => crate.x === cell.x && crate.y === cell.y)
  );
}

/** A pull steps away from an adjacent crate, bringing it along; else a plain step. */
function pullOnce(
  solved: SokobanBoard,
  walk: Walk,
  step: Pull
): SokobanDirection | null {
  const rotation = SOKOBAN_DIRECTIONS.indexOf(step.direction);
  for (let turn = 0; step.pull && turn < 4; turn += 1) {
    const toward = SOKOBAN_DIRECTIONS[(rotation + turn) % 4]!;
    const crate = walk.crates.findIndex(
      (entry) =>
        entry.x === shift(walk.worker, toward).x &&
        entry.y === shift(walk.worker, toward).y
    );
    const away = shift(walk.worker, OPPOSITE[toward]);
    if (crate === -1 || !standableFree(solved, walk, away)) continue;
    walk.crates[crate] = walk.worker;
    walk.worker = away;
    return OPPOSITE[toward];
  }
  const target = shift(walk.worker, step.direction);
  if (!standableFree(solved, walk, target)) return null;
  walk.worker = target;
  return step.direction;
}

/**
 * Walks back from a completed position: the worker steps away and may pull
 * the crate behind it along. Undoing each pull is a legal push, so the
 * reversed walk is a known solution of the board it ends on.
 */
function pulledBoard(
  solved: SokobanBoard,
  pulls: readonly Pull[]
): { readonly board: SokobanBoard; readonly solution: SokobanDirection[] } {
  if (solved.worker === null) throw new Error('solved board needs a worker');
  const walk: Walk = { worker: solved.worker, crates: [...solved.crates] };
  // Start beside a crate when one has room, so the first pulls can happen.
  const beside = solved.crates
    .flatMap((crate) => SOKOBAN_DIRECTIONS.map((way) => shift(crate, way)))
    .find((cell) => standableFree(solved, walk, cell));
  if (beside !== undefined) walk.worker = beside;
  const solution: SokobanDirection[] = [];
  for (const step of pulls) {
    const moved = pullOnce(solved, walk, step);
    if (moved !== null) solution.unshift(OPPOSITE[moved]);
  }
  return {
    board: canonical({ ...solved, worker: walk.worker, crates: walk.crates }),
    solution,
  };
}

/** Boards with a known solution, made by pulling crates off their goals. */
export function pulledBoardArb(): fc.Arbitrary<{
  readonly board: SokobanBoard;
  readonly solution: SokobanDirection[];
}> {
  return puzzleBoardArb({
    minSize: 4,
    maxWidth: 7,
    maxHeight: 6,
    maxCrates: 2,
  }).chain((board) => {
    const squares = [...board.squares];
    for (const crate of board.crates)
      squares[crate.y * board.width + crate.x] = 'goal';
    for (const [index, square] of board.squares.entries())
      if (
        square === 'goal' &&
        !board.crates.some((c) => c.y * board.width + c.x === index)
      )
        squares[index] = 'floor';
    const solved = { ...board, squares };
    return fc
      .array(
        fc.record({
          direction: directionArb,
          pull: fc.oneof(
            { weight: 3, arbitrary: fc.constant(true) },
            { weight: 1, arbitrary: fc.constant(false) }
          ),
        }),
        {
          minLength: 10,
          maxLength: 40,
        }
      )
      .map((pulls) => pulledBoard(solved, pulls));
  });
}
