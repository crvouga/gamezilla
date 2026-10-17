/**
 * Enrollment is automatic and complete: every registered game is in the
 * shared suites with production's very definitions, so no game can avoid
 * them by being left off a list.
 */

import { expect, test } from 'bun:test';
import { HARNESS_GAMES } from '@libs/games-harness/harness-games';
import { GAME_DEFINITIONS } from '@libs/games-shared/game-plugins';
import { CONFORMANCE_GAMES } from './conformance-world';

test('every registered game is enrolled in the shared suites, in registry order', () => {
  expect(HARNESS_GAMES.map((game) => game.shared.id)).toEqual(
    GAME_DEFINITIONS.map((game) => game.id)
  );
});

test('each enrolled game is the very definition production registers', () => {
  for (const [index, game] of HARNESS_GAMES.entries())
    expect(game.shared).toBe(GAME_DEFINITIONS[index]!);
});

test('each enrolled game shows the very client production registers', async () => {
  const { GAME_CLIENT_DEFINITIONS } = await import(
    '@libs/games-client/game-plugins.client'
  );
  for (const [index, game] of HARNESS_GAMES.entries())
    expect(game.client).toBe(GAME_CLIENT_DEFINITIONS[index]!);
});

test('the shared suites run every registered game and only test-only games beside them', () => {
  const registered = new Set<unknown>(GAME_DEFINITIONS);
  expect(
    CONFORMANCE_GAMES.filter((game) => registered.has(game.shared))
  ).toEqual([...HARNESS_GAMES]);
  for (const game of CONFORMANCE_GAMES)
    expect(
      GAME_DEFINITIONS.some((definition) => definition.id === game.shared.id)
    ).toBe(registered.has(game.shared));
});
