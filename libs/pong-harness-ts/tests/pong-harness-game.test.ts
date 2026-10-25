/**
 * Pong's conformance adapter names two of its own score targets, so the
 * shared custom-game suites change a choice where Pong has no turn clock;
 * the adapter is refused without them, or with ones Pong does not offer.
 */

import { expect, test } from 'bun:test';
import { assertHarnessGame } from '@libs/game-session-harness-ts/harness-game';
import { PONG_HARNESS_GAME } from '@libs/pong-harness-ts/pong-harness-game';

test("Pong's adapter names two different score targets Pong offers", () => {
  // regression: games-bindings-assume-clocked-turn-games
  const { configurationChoices: _named, ...unnamed } = PONG_HARNESS_GAME;
  expect(() => assertHarnessGame(unnamed)).toThrow(
    'Pong: name two game options exactly when the game offers options'
  );
  expect(() =>
    assertHarnessGame({
      ...PONG_HARNESS_GAME,
      configurationChoices: ['3', '0'],
    })
  ).toThrow('Pong: a named game option is refused');
  expect(() =>
    assertHarnessGame({
      ...PONG_HARNESS_GAME,
      configurationChoices: ['3', '3'],
    })
  ).toThrow('Pong: the two named game options are the same game');
  expect(assertHarnessGame(PONG_HARNESS_GAME)).toBe(PONG_HARNESS_GAME);
});
