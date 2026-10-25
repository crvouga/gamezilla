import { expect, test } from 'bun:test';
import {
  conformanceMatrix,
  offersAll,
  specificationGames,
} from '@libs/games-harness-ts/game-conformance';
import { PONG_HARNESS_GAME } from '@libs/pong-harness-ts/pong-harness-game';

test('a simulation-only game owes its actual shared capabilities without fabricated turns', () => {
  // regression: simulation-conformance-requires-turns
  expect(
    offersAll(PONG_HARNESS_GAME, [
      'rules',
      'custom-games',
      'matchmaking',
      'history',
    ])
  ).toBe(true);
  expect(
    specificationGames('specs/games/game-choices.feature', [PONG_HARNESS_GAME])
  ).toEqual([PONG_HARNESS_GAME]);
  expect(offersAll(PONG_HARNESS_GAME, ['simulation'])).toBe(true);
  expect(offersAll(PONG_HARNESS_GAME, ['turns'])).toBe(false);
  expect(offersAll(PONG_HARNESS_GAME, ['puzzles'])).toBe(false);
});

test('a simulation cannot satisfy its execution obligation through unrelated capability evidence', () => {
  const [row] = conformanceMatrix([PONG_HARNESS_GAME], []);
  expect(row?.cells.simulation.status).toBe('missing');
  expect(row?.cells.puzzles.status).toBe('unsupported');
});
