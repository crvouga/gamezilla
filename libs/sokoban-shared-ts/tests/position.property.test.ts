import { expect, test } from 'bun:test';
import {
  applySokobanMove,
  decodeSokobanAction,
  decodeSokobanPosition,
  encodeSokobanAction,
  encodeSokobanPosition,
  initialSokobanPosition,
  SOKOBAN_MOVE_LIMIT,
  sokobanComplete,
} from '@libs/sokoban-shared-ts/sokoban-position';
import {
  type Cell,
  parseSquareName,
  type SokobanBoard,
  type SokobanDirection,
  type SokobanPosition,
  squareName,
} from '@libs/sokoban-shared-ts/sokoban-types';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';
import {
  boardOf,
  directionsArb,
  LARGEST_ROWS,
  puzzleBoardArb,
  startOf,
} from './sokoban-fixtures';

const OFFSET: Readonly<Record<SokobanDirection, Cell>> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

function shifted(cell: Cell, direction: SokobanDirection): Cell {
  return { x: cell.x + OFFSET[direction].x, y: cell.y + OFFSET[direction].y };
}

function terrain(board: SokobanBoard, cell: Cell): string {
  const inside =
    cell.x >= 0 && cell.y >= 0 && cell.x < board.width && cell.y < board.height;
  return inside ? (board.squares[cell.y * board.width + cell.x] ?? '') : 'edge';
}

function free(board: SokobanBoard, position: SokobanPosition, cell: Cell) {
  return (
    ['floor', 'goal'].includes(terrain(board, cell)) &&
    !position.crates.some((crate) => crate.x === cell.x && crate.y === cell.y)
  );
}

/** Replays `directions`, checking every rule of a single move as it goes. */
function checkMove(
  board: SokobanBoard,
  position: SokobanPosition,
  direction: SokobanDirection
): SokobanPosition {
  const before = JSON.stringify({ board, position });
  const result = applySokobanMove(board, position, direction);
  expect(JSON.stringify({ board, position })).toBe(before);
  const ahead = shifted(position.worker, direction);
  const pushed = position.crates.findIndex(
    (crate) => crate.x === ahead.x && crate.y === ahead.y
  );
  if (!result.valid) {
    const code = result.issues[0]?.code;
    if (!['floor', 'goal'].includes(terrain(board, ahead)))
      expect(code).toBe('blocked');
    else {
      expect(pushed).not.toBe(-1);
      expect(free(board, position, shifted(ahead, direction))).toBe(false);
      expect(code).toBe('crate_blocked');
    }
    return position;
  }
  const next = result.value;
  expect(next.worker).toEqual(ahead);
  expect(next.moves).toBe(position.moves + 1);
  expect(next.crates).toHaveLength(position.crates.length);
  if (pushed === -1) {
    expect(free(board, position, ahead)).toBe(true);
    expect(next.crates).toEqual(position.crates);
    expect(next.pushes).toBe(position.pushes);
  } else {
    expect(next.pushes).toBe(position.pushes + 1);
    next.crates.forEach((crate, index) =>
      expect(crate).toEqual(
        index === pushed
          ? shifted(position.crates[index]!, direction)
          : position.crates[index]!
      )
    );
  }
  expect(decodeSokobanPosition(board, encodeSokobanPosition(next))).toEqual({
    valid: true,
    value: next,
  });
  return next;
}

test('every move steps or pushes one crate one square, and a refused move changes nothing', () => {
  assertProperty(
    'single moves',
    fc.property(
      puzzleBoardArb({ maxWidth: 6, maxHeight: 5, maxCrates: 3 }),
      directionsArb(40),
      (board, directions) => {
        let position = startOf(board);
        for (const direction of directions)
          position = checkMove(board, position, direction);
        expect(position.pushes).toBeLessThanOrEqual(position.moves);
      }
    )
  );
});

test('completion is exactly every crate on a goal, including at the start', () => {
  assertProperty(
    'completion',
    fc.property(
      puzzleBoardArb({ maxWidth: 5, maxHeight: 4, maxCrates: 2 }),
      directionsArb(30),
      (board, directions) => {
        let position = startOf(board);
        const onGoals = (at: SokobanPosition): boolean =>
          at.crates.every((crate) => terrain(board, crate) === 'goal');
        expect(sokobanComplete(board, position)).toBe(onGoals(position));
        for (const direction of directions) {
          const next = applySokobanMove(board, position, direction);
          if (next.valid) position = next.value;
          expect(sokobanComplete(board, position)).toBe(onGoals(position));
        }
      }
    )
  );
  const done = boardOf('@**');
  expect(sokobanComplete(done, startOf(done))).toBe(true);
  expect(startOf(done)).toMatchObject({ moves: 0, pushes: 0 });
  const unfinished = boardOf('@*$.');
  expect(sokobanComplete(unfinished, startOf(unfinished))).toBe(false);
});

function play(rows: readonly string[], moves: readonly SokobanDirection[]) {
  const board = boardOf(...rows);
  let position = startOf(board);
  let refusal: string | undefined;
  for (const direction of moves) {
    const next = applySokobanMove(board, position, direction);
    refusal = next.valid ? undefined : next.issues[0]?.code;
    if (next.valid) position = next.value;
  }
  return {
    board,
    position,
    refusal,
    worker: squareName(position.worker),
    crates: position.crates.map(squareName),
  };
}

test('the moves and pushes of the product examples', () => {
  const corridor = ['~###', '@ $.', '####'];
  expect(play(corridor, ['right'])).toMatchObject({
    worker: 'B2',
    position: { moves: 1, pushes: 0 },
  });
  for (const direction of ['down', 'up', 'left'] as const)
    expect(play(corridor, [direction])).toMatchObject({
      refusal: 'blocked',
      worker: 'A2',
      position: { moves: 0, pushes: 0 },
    });
  expect(play(['@$ .'], ['right'])).toMatchObject({
    worker: 'B1',
    crates: ['C1'],
    position: { moves: 1, pushes: 1 },
  });
  expect(play(['#.@$#'], ['right'])).toMatchObject({
    refusal: 'crate_blocked',
    crates: ['D1'],
    position: { moves: 0, pushes: 0 },
  });
  expect(play(['@$$ ..'], ['right'])).toMatchObject({
    refusal: 'crate_blocked',
    worker: 'A1',
    crates: ['B1', 'C1'],
  });
  expect(play(['. @$'], ['left'])).toMatchObject({
    worker: 'B1',
    crates: ['D1'],
    position: { moves: 1, pushes: 0 },
  });
  expect(play(['@ $ .'], ['right', 'right', 'right'])).toMatchObject({
    position: { moves: 3, pushes: 2 },
  });
  expect(play(['.@ $#'], ['right', 'right'])).toMatchObject({
    refusal: 'crate_blocked',
    position: { moves: 1, pushes: 0 },
  });
  const finished = play(['@$.*'], ['right']);
  expect(sokobanComplete(finished.board, finished.position)).toBe(true);
  const unfinished = play(['@$. $.'], ['right']);
  expect(sokobanComplete(unfinished.board, unfinished.position)).toBe(false);
  expect(unfinished.crates).toContain('C1');
});

test('refusals explain themselves in plain English', () => {
  const board = boardOf('.#@$#');
  const start = startOf(board);
  expect(applySokobanMove(board, start, 'left')).toEqual({
    valid: false,
    issues: [{ code: 'blocked', message: "The worker's way is blocked." }],
  });
  expect(applySokobanMove(board, start, 'right')).toEqual({
    valid: false,
    issues: [{ code: 'crate_blocked', message: 'That crate cannot move.' }],
  });
});

test('crates keep their index for the whole attempt', () => {
  const twoCrates = boardOf(' $@$ ', '. . .', '  $  ');
  const moved = applySokobanMove(twoCrates, startOf(twoCrates), 'left');
  expect(moved.valid && moved.value.crates.map(squareName)).toEqual([
    'A1',
    'D1',
    'C3',
  ]);
});

test('positions round-trip and the decoder is total on untrusted input', () => {
  const board = boardOf('#####', '#@$.#', '#####');
  assertProperty(
    'untrusted positions',
    fc.property(
      fc.oneof(
        fc.string(),
        fc.jsonValue().map((value) => JSON.stringify(value)),
        fc
          .record({
            worker: fc.tuple(fc.integer(), fc.integer()),
            crates: fc.array(fc.tuple(fc.integer(), fc.integer())),
            moves: fc.integer(),
            pushes: fc.integer(),
          })
          .map((value) => JSON.stringify(value))
      ),
      (text) => {
        const decoded = decodeSokobanPosition(board, text);
        if (decoded.valid)
          expect(
            decodeSokobanPosition(board, encodeSokobanPosition(decoded.value))
          ).toEqual(decoded);
      }
    )
  );
  const read = (value: unknown) =>
    decodeSokobanPosition(board, JSON.stringify(value)).valid;
  const position = { worker: [1, 1], crates: [[2, 1]], moves: 0, pushes: 0 };
  expect(read(position)).toBe(true);
  expect(read({ ...position, crates: [[1, 1]] })).toBe(false);
  expect(read({ ...position, crates: [] })).toBe(false);
  expect(
    read({
      ...position,
      crates: [
        [2, 1],
        [3, 1],
      ],
    })
  ).toBe(false);
  expect(read({ ...position, worker: [0, 1] })).toBe(false);
  expect(read({ ...position, worker: [9, 9] })).toBe(false);
  expect(read({ ...position, moves: 1, pushes: 2 })).toBe(false);
  expect(read({ ...position, moves: 0.5 })).toBe(false);
  expect(read({ ...position, moves: SOKOBAN_MOVE_LIMIT + 1 })).toBe(false);
  expect(read({ ...position, extra: true })).toBe(false);
  expect(decodeSokobanPosition(board, 7).valid).toBe(false);
  expect(decodeSokobanPosition(board, ' '.repeat(70_000)).valid).toBe(false);
});

test('an attempt stops at the move limit rather than writing an unreadable position', () => {
  const board = boardOf('@ $.');
  const limit = { ...startOf(board), moves: SOKOBAN_MOVE_LIMIT };
  expect(applySokobanMove(board, limit, 'right')).toMatchObject({
    valid: false,
    issues: [{ code: 'move_limit' }],
  });
  expect(applySokobanMove(board, limit, 'left')).toMatchObject({
    issues: [{ code: 'blocked' }],
  });
});

test('a board without a worker or with unequal crates has no starting position', () => {
  expect(initialSokobanPosition(boardOf(' $.')).valid).toBe(false);
  expect(initialSokobanPosition(boardOf('@$..')).valid).toBe(false);
});

test('actions are the LURD letters and nothing else', () => {
  for (const direction of ['up', 'down', 'left', 'right'] as const)
    expect(decodeSokobanAction(encodeSokobanAction(direction))).toEqual({
      valid: true,
      value: direction,
    });
  expect(encodeSokobanAction('up')).toBe('u');
  for (const text of ['U', 'up', '', 'ud', ' u', '"u"', 'x', null])
    expect(decodeSokobanAction(text)).toMatchObject({
      valid: false,
      issues: [{ code: 'invalid_action' }],
    });
});

test('a 20 by 20 board plays thousands of moves at the size limit', () => {
  const board = boardOf(...LARGEST_ROWS);
  expect(board).toMatchObject({ width: 20, height: 20 });
  const directions: readonly SokobanDirection[] = [
    'down',
    'right',
    'up',
    'left',
  ];
  let position = startOf(board);
  for (let index = 0; index < 4000; index += 1) {
    const direction = directions[(index * 7 + Math.floor(index / 13)) % 4]!;
    position = checkMove(board, position, direction);
  }
  expect(position.moves).toBeGreaterThan(0);
  expect(parseSquareName('T20')).toEqual({ x: 19, y: 19 });
});
