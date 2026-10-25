import { expect, test } from 'bun:test';
import {
  assertGameSides,
  type GameSide,
  gameSides,
} from '@pkgs/turn-game-shared-ts/game-rules';

test.each([
  [['white', 'black']],
  [['white', 'black', 'red']],
  [['white', 'black', 'red', 'blue']],
] as const)('%p is an accepted ordered roster', (sides) => {
  expect(() => assertGameSides({ id: 'race', sides })).not.toThrow();
  expect(gameSides({ sides })).toEqual(sides);
});

test.each([
  [['white']],
  [['black', 'white']],
  [['white', 'black', 'blue']],
  [['white', 'black', 'red', 'red']],
  [['white', 'black', 'red', 'blue', 'white']],
] as readonly (readonly GameSide[])[][])('%p is refused', (sides) => {
  expect(() => assertGameSides({ id: 'race', sides })).toThrow(
    'declare two to four ordered seats'
  );
});

test('a rule set without declared seats has the standard two', () => {
  expect(gameSides({})).toEqual(['white', 'black']);
});
