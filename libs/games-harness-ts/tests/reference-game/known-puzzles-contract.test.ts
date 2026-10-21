/**
 * The harness fixture contract for puzzles: a game's known puzzles are
 * required exactly when its definition offers puzzles — a type error
 * otherwise, and refused by `assertHarnessGame` for what a type cannot see
 * (an adapter typed loosely, a spread copy) — and the known puzzles
 * themselves must include one the session suites can retry and step
 * through, with ids of their own.
 */

import { expect, test } from 'bun:test';
import { defineGameClient } from '@libs/game-menu-client-ts/game-client';
import type {
  HarnessGame,
  PlayableGame,
} from '@libs/game-session-harness-ts/harness-game';
import { assertHarnessGame } from '@libs/game-session-harness-ts/harness-game';
import type { PuzzleFixture } from '@libs/game-session-harness-ts/known-puzzles';
import { defineTurnGame } from '@libs/game-session-shared-ts/turn-game-definition';
import {
  COUNTING_RACE_CLIENT,
  COUNTING_RACE_FIXTURES,
  COUNTING_RACE_GAME,
  COUNTING_RACE_SHARED,
  COUNTING_RACE_TURN_GAME,
} from './counting-race-game';

const { puzzles: known, ...rulesFixtures } = COUNTING_RACE_FIXTURES;
const { puzzles: _part, ...clientWithoutPuzzles } = COUNTING_RACE_CLIENT;

/** The reference game offering custom games and history, but no puzzles. */
const WITHOUT_PUZZLES = defineTurnGame({
  ...COUNTING_RACE_TURN_GAME,
  capabilities: {
    'custom-games': COUNTING_RACE_TURN_GAME.capabilities['custom-games'],
    history: COUNTING_RACE_TURN_GAME.capabilities.history,
  },
});

const knownPuzzle = (id: string): PuzzleFixture => {
  const found = known.find((fixture) => fixture.record.id === id);
  if (found === undefined) throw new Error(`no known puzzle ${id}`);
  return found;
};

test('a game offering puzzles must name known puzzles, and a game offering none must not (type checking)', () => {
  const missing: PlayableGame<typeof COUNTING_RACE_SHARED.capabilities> = {
    label: 'counting race',
    shared: COUNTING_RACE_SHARED,
    // @ts-expect-error a game offering puzzles names its known puzzles
    fixtures: rulesFixtures,
  };
  const extra: PlayableGame<typeof WITHOUT_PUZZLES.capabilities> = {
    label: 'counting race',
    shared: WITHOUT_PUZZLES,
    // @ts-expect-error only a game offering puzzles names known puzzles
    fixtures: { ...rulesFixtures, puzzles: known },
  };
  expect([missing.label, extra.label]).toEqual([
    'counting race',
    'counting race',
  ]);
});

test('assertHarnessGame refuses a game offering puzzles without known puzzles, and known puzzles of a game offering none', () => {
  expect(() =>
    assertHarnessGame({ ...COUNTING_RACE_GAME, fixtures: rulesFixtures })
  ).toThrow(
    'counting race: a game offering puzzles names known puzzles of its own (fixtures.puzzles)'
  );
  // Typed loosely, as a spread copy would be, the adapter compiles.
  const loose: HarnessGame = {
    ...COUNTING_RACE_GAME,
    shared: WITHOUT_PUZZLES,
    client: defineGameClient({
      ...clientWithoutPuzzles,
      shared: WITHOUT_PUZZLES,
    }),
  };
  expect(() => assertHarnessGame(loose)).toThrow(
    'counting race: only a game offering puzzles names known puzzles'
  );
});

test('the known puzzles include one of two solver moves, and no two share an id', () => {
  const long = knownPuzzle('counting-race/leap-past-four');
  // From four, the Tortoise counts one and the Hare leaps home: one solver
  // move alone.
  const short: PuzzleFixture = {
    ...long,
    record: {
      ...long.record,
      id: 'counting-race/leap-at-once',
      position: 'race:4b',
      line: ['advance', 'leap'],
    },
    solverSide: 'white',
    solution: ['leap'],
    labels: ['step 5', 'leap to 7'],
    wrongMove: { at: 1, action: 'advance' },
    refusedMove: { at: 1, action: 'retreat' },
    opponentMove: { at: 1, action: 'tortoise-advance' },
  };
  expect(() =>
    assertHarnessGame({
      ...COUNTING_RACE_GAME,
      fixtures: { ...rulesFixtures, puzzles: [short] },
    })
  ).toThrow('name a known puzzle of two solver moves or more');
  expect(() =>
    assertHarnessGame({
      ...COUNTING_RACE_GAME,
      fixtures: { ...rulesFixtures, puzzles: [long, long] },
    })
  ).toThrow('two known puzzles share an id');
});

test('the reference game keeps the contract', () => {
  expect(assertHarnessGame(COUNTING_RACE_GAME)).toBe(COUNTING_RACE_GAME);
});
