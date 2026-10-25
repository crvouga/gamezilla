import { expect, test } from 'bun:test';
import {
  type LightCyclesArena,
  type LightCyclesProposal,
  resolveMovement,
} from '@libs/light-cycles-shared-ts/light-cycles-collision';
import { LIGHT_CYCLES_SEAT_ORDER } from '@libs/light-cycles-shared-ts/light-cycles-config';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';

const WIDTH = 6;
const HEIGHT = 4;

/** Rows top to bottom; '.' empty, '0'..'3' a seat's trail. */
function arena(...rows: string[]): LightCyclesArena {
  return { trails: rows.join(''), width: rows[0]!.length, height: rows.length };
}

function crashes(
  outcome: ReturnType<typeof resolveMovement>
): Record<string, string | null> {
  return Object.fromEntries(
    outcome.outcomes.map((item) => [item.seat, item.crash])
  );
}

const open = arena('......', '......', '......', '......');

test('a target outside the arena is a wall crash on every side', () => {
  for (const [x, y] of [
    [-1, 0],
    [WIDTH, 2],
    [3, -1],
    [0, HEIGHT],
  ] as const) {
    const moved = resolveMovement(open, [{ seat: 'white', x, y }]);
    expect(crashes(moved)).toEqual({ white: 'wall' });
    expect(moved.trails).toBe(open.trails);
  }
});

test('entering an own trail, another trail, a crashed rider trail or an old head is a trail crash', () => {
  const board = arena('000...', '..1...', '..2...', '......');
  // Own trail, another rider's trail and a crashed rider's trail all occupy.
  expect(
    crashes(
      resolveMovement(board, [
        { seat: 'white', x: 0, y: 0 },
        { seat: 'black', x: 1, y: 0 },
        { seat: 'blue', x: 2, y: 2 },
      ])
    )
  ).toEqual({ white: 'trail', black: 'trail', blue: 'trail' });
  // The rider at (2,1) leaves its cell this step; its old head still blocks.
  const moved = resolveMovement(board, [
    { seat: 'black', x: 3, y: 1 },
    { seat: 'white', x: 2, y: 1 },
  ]);
  expect(crashes(moved)).toEqual({ white: 'trail', black: null });
  expect(moved.trails).toBe('000.....11....2.........');
});

test('two or three riders claiming one empty cell all crash and nobody enters it', () => {
  const board = arena('......', '.0.1..', '..2...', '......');
  const two = resolveMovement(board, [
    { seat: 'white', x: 2, y: 1 },
    { seat: 'black', x: 2, y: 1 },
    { seat: 'red', x: 2, y: 3 },
  ]);
  expect(crashes(two)).toEqual({
    white: 'contested',
    black: 'contested',
    red: null,
  });
  expect(two.trails[1 * WIDTH + 2]).toBe('.');
  const three = resolveMovement(board, [
    { seat: 'white', x: 2, y: 1 },
    { seat: 'black', x: 2, y: 1 },
    { seat: 'red', x: 2, y: 1 },
  ]);
  expect(crashes(three)).toEqual({
    white: 'contested',
    black: 'contested',
    red: 'contested',
  });
  expect(three.trails).toBe(board.trails);
});

test('a head swap crashes both riders because each target is occupied', () => {
  const board = arena('......', '..01..', '......', '......');
  const moved = resolveMovement(board, [
    { seat: 'white', x: 3, y: 1 },
    { seat: 'black', x: 2, y: 1 },
  ]);
  expect(crashes(moved)).toEqual({ white: 'trail', black: 'trail' });
  expect(moved.trails).toBe(board.trails);
});

test('a contested cell that is also occupied reports the occupation', () => {
  const board = arena('......', '..1...', '......', '......');
  const moved = resolveMovement(board, [
    { seat: 'white', x: 2, y: 1 },
    { seat: 'red', x: 2, y: 1 },
  ]);
  expect(crashes(moved)).toEqual({ white: 'trail', red: 'trail' });
});

const proposal = fc.record({
  x: fc.integer({ min: -1, max: WIDTH }),
  y: fc.integer({ min: -1, max: HEIGHT }),
});

test('movement resolution does not depend on proposal order', () => {
  assertProperty(
    'Light Cycles order-independent resolution',
    fc.property(
      fc.array(fc.constantFrom('.', '.', '.', '0', '1', '2', '3'), {
        minLength: WIDTH * HEIGHT,
        maxLength: WIDTH * HEIGHT,
      }),
      fc.array(proposal, { minLength: 1, maxLength: 4 }),
      fc.boolean(),
      (cells, targets, crowd) => {
        const board = { trails: cells.join(''), width: WIDTH, height: HEIGHT };
        // Crowding pulls every target onto the first, exercising contests.
        const proposals: LightCyclesProposal[] = targets.map(
          (target, index) => ({
            seat: LIGHT_CYCLES_SEAT_ORDER[index]!,
            ...(crowd ? targets[0]! : target),
          })
        );
        const expected = resolveMovement(board, proposals);
        for (const order of permutations(proposals))
          expect(resolveMovement(board, order)).toEqual(expected);
        for (const item of expected.outcomes) {
          const inside =
            item.x >= 0 && item.y >= 0 && item.x < WIDTH && item.y < HEIGHT;
          if (item.crash === null)
            expect(board.trails[item.y * WIDTH + item.x]).toBe('.');
          if (!inside) expect(item.crash).toBe('wall');
        }
      }
    )
  );
}, 60_000);

function permutations<T>(items: readonly T[]): T[][] {
  if (items.length <= 1) return [[...items]];
  return items.flatMap((item, index) =>
    permutations(items.filter((_, other) => other !== index)).map((rest) => [
      item,
      ...rest,
    ])
  );
}
