import { expect, test } from 'bun:test';
import {
  eraseSokobanSquare,
  initialSokobanDefinition,
  paintSokobanSquare,
  placeSokobanCrate,
  placeSokobanWorker,
  removeSokobanCrate,
  resizeSokobanBoard,
  type SokobanRemoval,
} from '@libs/sokoban-shared-ts/sokoban-board-edits';
import {
  decodeSokobanBoard,
  encodeSokobanBoard,
  sokobanBoardRows,
  sokobanCorrections,
} from '@libs/sokoban-shared-ts/sokoban-definition';
import { solveSokoban } from '@libs/sokoban-shared-ts/sokoban-solver';
import {
  type Cell,
  parseSquareName,
  SOKOBAN_SQUARES,
  type SokobanBoard,
  type SokobanSquare,
  type Validation,
} from '@libs/sokoban-shared-ts/sokoban-types';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';
import { boardOf, draftBoardArb } from './sokoban-fixtures';

const boardAndCell = draftBoardArb().chain((board) =>
  fc.record({
    board: fc.constant(board),
    cell: fc.record({
      x: fc.integer({ min: 0, max: board.width - 1 }),
      y: fc.integer({ min: 0, max: board.height - 1 }),
    }),
  })
);

const has = (cells: readonly Cell[], cell: Cell): boolean =>
  cells.some((entry) => entry.x === cell.x && entry.y === cell.y);
const at = (board: SokobanBoard, cell: Cell): SokobanSquare | undefined =>
  board.squares[cell.y * board.width + cell.x];

/** Every edit leaves a board the codec reads back exactly, and never touches its input. */
function edited(
  board: SokobanBoard,
  edit: () => Validation<SokobanBoard>
): Validation<SokobanBoard> {
  const before = encodeSokobanBoard(board);
  const result = edit();
  expect(encodeSokobanBoard(board)).toBe(before);
  if (result.valid)
    expect(decodeSokobanBoard(encodeSokobanBoard(result.value))).toEqual({
      valid: true,
      value: result.value,
    });
  return result;
}

function unchangedElsewhere(
  board: SokobanBoard,
  next: SokobanBoard,
  cell: Cell
): void {
  const index = cell.y * board.width + cell.x;
  board.squares.forEach((square, other) => {
    if (other !== index) expect(next.squares[other]).toBe(square);
  });
  const outside = (cells: readonly Cell[]) =>
    cells.filter((entry) => entry.x !== cell.x || entry.y !== cell.y);
  expect(outside(next.crates)).toEqual(outside(board.crates));
  if (board.worker !== null && !has([cell], board.worker))
    expect(next.worker).toEqual(board.worker);
}

function oracleRemovals(
  board: SokobanBoard,
  width: number,
  height: number
): SokobanRemoval[] {
  const removed: SokobanRemoval[] = [];
  for (let y = 0; y < board.height; y += 1)
    for (let x = 0; x < board.width; x += 1) {
      const cell = { x, y };
      if (x < width && y < height) continue;
      if (board.worker !== null && has([board.worker], cell))
        removed.push({ kind: 'worker', cell });
      if (has(board.crates, cell)) removed.push({ kind: 'crate', cell });
      if (at(board, cell) === 'goal') removed.push({ kind: 'goal', cell });
    }
  return removed;
}

test('resizing keeps what is inside, adds floor, and reports exactly what it removed', () => {
  const size = fc.integer({ min: 1, max: 7 });
  assertProperty(
    'resize',
    fc.property(draftBoardArb(), size, size, (board, width, height) => {
      const before = encodeSokobanBoard(board);
      const result = resizeSokobanBoard(board, width, height);
      expect(encodeSokobanBoard(board)).toBe(before);
      if (!result.valid) throw new Error('a size from 1 to 20 is refused');
      const next = result.value.board;
      expect(result.value.removed).toEqual(
        oracleRemovals(board, width, height)
      );
      expect(next).toMatchObject({ width, height });
      for (let y = 0; y < height; y += 1)
        for (let x = 0; x < width; x += 1)
          expect(at(next, { x, y })).toBe(
            x < board.width && y < board.height ? at(board, { x, y }) : 'floor'
          );
      for (const piece of [
        ...next.crates,
        ...(next.worker ? [next.worker] : []),
      ])
        expect(piece.x < width && piece.y < height).toBe(true);
      const kept = board.crates.filter((c) => c.x < width && c.y < height);
      expect(next.crates).toEqual(kept);
      expect(decodeSokobanBoard(encodeSokobanBoard(next)).valid).toBe(true);
    })
  );
});

test('a board has 1 to 20 columns and rows, and an unchanged size is the same board', () => {
  const board = boardOf('@$.', '   ');
  expect(resizeSokobanBoard(board, 20, 20)).toMatchObject({
    valid: true,
    value: { board: { width: 20, height: 20 }, removed: [] },
  });
  for (const [width, height] of [
    [21, 20],
    [20, 21],
  ] as const)
    expect(resizeSokobanBoard(board, width, height)).toEqual({
      valid: false,
      issues: [
        {
          code: 'board_too_large',
          message: 'A board has at most 20 columns and 20 rows.',
        },
      ],
    });
  expect(resizeSokobanBoard(board, 0, 2)).toMatchObject({
    issues: [{ code: 'board_too_small' }],
  });
  expect(resizeSokobanBoard(board, 3, 0)).toMatchObject({
    issues: [{ code: 'board_too_small' }],
  });
  expect(resizeSokobanBoard(board, 2.5, 2)).toMatchObject({
    issues: [{ code: 'invalid_size' }],
  });
  const same = resizeSokobanBoard(board, 3, 2);
  expect(same.valid && same.value.board).toBe(board);
});

test('a smaller board names the crate and goal beyond its new edge', () => {
  const board = boardOf('@$.$', '   .', '####');
  const smaller = resizeSokobanBoard(board, 3, 3);
  expect(smaller).toEqual({
    valid: true,
    value: {
      board: boardOf('@$.', '   ', '###'),
      removed: [
        { kind: 'crate', cell: { x: 3, y: 0 } },
        { kind: 'goal', cell: { x: 3, y: 1 } },
      ],
    },
  });
  const shorter = resizeSokobanBoard(board, 4, 2);
  expect(shorter.valid && sokobanBoardRows(shorter.value.board)).toEqual([
    '@$.$',
    '   .',
  ]);
  const lost = resizeSokobanBoard(boardOf('  ', ' +'), 1, 1);
  expect(lost.valid && lost.value.removed).toEqual([
    { kind: 'worker', cell: { x: 1, y: 1 } },
    { kind: 'goal', cell: { x: 1, y: 1 } },
  ]);
});

test('painting sets one square; a wall or outside removes its piece, a goal or floor keeps it', () => {
  assertProperty(
    'paint',
    fc.property(
      boardAndCell,
      fc.constantFrom(...SOKOBAN_SQUARES),
      ({ board, cell }, square) => {
        const result = edited(board, () =>
          paintSokobanSquare(board, cell, square)
        );
        if (!result.valid) throw new Error('painting a square was refused');
        const next = result.value;
        expect(at(next, cell)).toBe(square);
        unchangedElsewhere(board, next, cell);
        const standable = square === 'floor' || square === 'goal';
        expect(has(next.crates, cell)).toBe(
          standable && has(board.crates, cell)
        );
        const workerHere = board.worker !== null && has([board.worker], cell);
        expect(next.worker !== null && has([next.worker], cell)).toBe(
          standable && workerHere
        );
        if (at(board, cell) === square) expect(next).toBe(board);
      }
    )
  );
});

test('the painting examples', () => {
  const board = boardOf(' @$.');
  const paint = (name: string, square: SokobanSquare) => {
    const result = paintSokobanSquare(board, parseSquareName(name)!, square);
    return result.valid ? sokobanBoardRows(result.value) : result.issues;
  };
  expect(paint('C1', 'goal')).toEqual([' @*.']);
  expect(paint('C1', 'wall')).toEqual([' @#.']);
  expect(paint('B1', 'outside')).toEqual([' ~$.']);
  expect(paint('D1', 'floor')).toEqual([' @$ ']);
  expect(paint('A1', 'floor')).toEqual([' @$.']);
  expect(paintSokobanSquare(board, { x: 4, y: 0 }, 'wall')).toMatchObject({
    issues: [{ code: 'not_on_board' }],
  });
  const before = encodeSokobanBoard(board);
  const same = paintSokobanSquare(board, { x: 3, y: 0 }, 'goal');
  expect(same.valid && encodeSokobanBoard(same.value)).toBe(before);
});

test('erasing makes floor and removes any piece or goal there', () => {
  assertProperty(
    'erase',
    fc.property(boardAndCell, ({ board, cell }) => {
      const result = edited(board, () => eraseSokobanSquare(board, cell));
      if (!result.valid) throw new Error('erasing a square was refused');
      const next = result.value;
      expect(at(next, cell)).toBe('floor');
      expect(has(next.crates, cell)).toBe(false);
      expect(next.worker !== null && has([next.worker], cell)).toBe(false);
      unchangedElsewhere(board, next, cell);
    })
  );
  const board = boardOf(' @*#');
  const erase = (name: string) => {
    const result = eraseSokobanSquare(board, parseSquareName(name)!);
    return result.valid && sokobanBoardRows(result.value);
  };
  expect(erase('C1')).toEqual([' @ #']);
  expect(erase('D1')).toEqual([' @* ']);
  expect(erase('B1')).toEqual(['  *#']);
});

test('the worker and crates go only on empty floor or goals, and placing the worker moves it', () => {
  assertProperty(
    'placing pieces',
    fc.property(boardAndCell, ({ board, cell }) => {
      const square = at(board, cell);
      const standable = square === 'floor' || square === 'goal';
      const crateHere = has(board.crates, cell);
      const workerHere = board.worker !== null && has([board.worker], cell);
      const worker = edited(board, () => placeSokobanWorker(board, cell));
      const expectedWorker = !standable
        ? 'not_standable'
        : crateHere
          ? 'occupied'
          : null;
      if (worker.valid) {
        expect(expectedWorker).toBeNull();
        expect(worker.value.worker).toEqual(cell);
        expect(worker.value.crates).toEqual(board.crates);
        expect(worker.value.squares).toEqual(board.squares);
      } else expect(worker.issues[0]?.code).toBe(expectedWorker!);
      const crate = edited(board, () => placeSokobanCrate(board, cell));
      const expectedCrate = !standable
        ? 'not_standable'
        : crateHere || workerHere
          ? 'occupied'
          : null;
      if (crate.valid) {
        expect(expectedCrate).toBeNull();
        expect(crate.value.crates).toHaveLength(board.crates.length + 1);
        expect(has(crate.value.crates, cell)).toBe(true);
        expect(crate.value.worker).toEqual(board.worker);
      } else expect(crate.issues[0]?.code).toBe(expectedCrate!);
      const removed = edited(board, () => removeSokobanCrate(board, cell));
      if (removed.valid) {
        expect(crateHere).toBe(true);
        expect(has(removed.value.crates, cell)).toBe(false);
        expect(removed.value.crates).toHaveLength(board.crates.length - 1);
        expect(removed.value.squares).toEqual(board.squares);
      } else expect(removed.issues[0]?.code).toBe('no_crate');
    })
  );
});

test('the placing examples', () => {
  const rows = (result: Validation<SokobanBoard>) =>
    result.valid ? sokobanBoardRows(result.value) : result.issues;
  const board = boardOf(' @$.');
  const square = (name: string) => parseSquareName(name)!;
  expect(rows(placeSokobanWorker(board, square('A1')))).toEqual(['@ $.']);
  expect(rows(placeSokobanWorker(board, square('D1')))).toEqual(['  $+']);
  expect(rows(placeSokobanCrate(board, square('A1')))).toEqual(['$@$.']);
  expect(rows(removeSokobanCrate(board, square('C1')))).toEqual([' @ .']);
  expect(rows(removeSokobanCrate(board, square('A1')))).toEqual([
    { code: 'no_crate', message: 'There is no crate on that square.' },
  ]);
  const walled = boardOf('~#@$.');
  expect(rows(placeSokobanCrate(walled, square('E1')))).toEqual(['~#@$*']);
  const notStandable = [
    {
      code: 'not_standable',
      message: 'The worker and crates stand only on floor or goals.',
    },
  ];
  expect(rows(placeSokobanWorker(walled, square('B1')))).toEqual(notStandable);
  expect(rows(placeSokobanCrate(walled, square('A1')))).toEqual(notStandable);
  const occupied = [
    { code: 'occupied', message: 'That square already has a piece.' },
  ];
  expect(rows(placeSokobanCrate(walled, square('C1')))).toEqual(occupied);
  expect(rows(placeSokobanWorker(walled, square('D1')))).toEqual(occupied);
  expect(placeSokobanCrate(walled, { x: 9, y: 0 })).toMatchObject({
    issues: [{ code: 'not_on_board' }],
  });
  const still = placeSokobanWorker(walled, square('C1'));
  expect(still.valid && still.value).toBe(walled);
});

test('the corrections examples follow board edits', () => {
  const codes = (result: Validation<SokobanBoard>) =>
    result.valid ? sokobanCorrections(result.value).map((i) => i.code) : null;
  expect(codes(placeSokobanWorker(boardOf(' $.'), { x: 0, y: 0 }))).toEqual([]);
  expect(codes(eraseSokobanSquare(boardOf('@$.'), { x: 0, y: 0 }))).toEqual([
    'needs_worker',
  ]);
  expect(codes(removeSokobanCrate(boardOf('@*'), { x: 1, y: 0 }))).toEqual([
    'needs_crate',
    'crate_goal_mismatch',
  ]);
  expect(codes(placeSokobanCrate(boardOf('@$. '), { x: 3, y: 0 }))).toEqual([
    'crate_goal_mismatch',
  ]);
});

test('a new draft starts as a small playable walled room', () => {
  const board = decodeSokobanBoard(initialSokobanDefinition());
  if (!board.valid) throw new Error('the new draft board is unreadable');
  expect(sokobanCorrections(board.value)).toEqual([]);
  expect(board.value.crates).toHaveLength(1);
  expect(board.value.squares[0]).toBe('wall');
  expect(solveSokoban(board.value, { maxStates: 1000 }).status).toBe('solved');
});
