/**
 * Enrollment is automatic and complete: every registered game is in the
 * shared suites with production's very definitions, so no game can avoid
 * them by being left off a list.
 */

import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { HARNESS_GAMES } from '@libs/games-harness-ts/harness-games';
import { GAME_DEFINITIONS } from '@libs/games-shared-ts/game-plugins';
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
    '@libs/games-client-ts/game-plugins.client'
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

test('every game a package implements is registered, and every registered game has packages', () => {
  const root = join(import.meta.dir, '../../..');
  const declared = new Set<string>();
  for (const tier of ['apps', 'libs', 'pkgs'])
    for (const manifest of new Bun.Glob(`${tier}/*/package.json`).scanSync(
      root
    )) {
      const { game } = JSON.parse(
        readFileSync(join(root, manifest), 'utf8')
      ) as { game?: string };
      if (game !== undefined) declared.add(game);
    }
  expect([...declared].sort()).toEqual(
    GAME_DEFINITIONS.map((game) => game.id).sort()
  );
});
