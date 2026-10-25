/**
 * Enrollment is automatic and complete: every registered game is in the
 * shared suites with production's very definitions, so no game can avoid
 * them by being left off a list.
 */

import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isTurnGameDefinition } from '@libs/game-session-shared-ts/turn-game-definition';
import { packageFamilyProblems } from '@libs/games-harness-ts/conformance-enrollment';
import { enrollmentProblems } from '@libs/games-harness-ts/game-conformance';
import { HARNESS_GAMES } from '@libs/games-harness-ts/harness-games';
import {
  GAME_DEFINITIONS,
  TURN_GAME_DEFINITIONS,
} from '@libs/games-shared-ts/game-plugins';
import { gameFamily } from '@pkgs/turn-game-shared-ts/game-rules';
import { CONFORMANCE_GAMES } from './conformance-world';

test('every registered turn game is enrolled in the turn suites, in registry order', () => {
  expect(HARNESS_GAMES.map((game) => game.shared.id)).toEqual(
    TURN_GAME_DEFINITIONS.map((game) => game.id)
  );
});

test('each enrolled game is the very definition production registers', () => {
  for (const [index, game] of HARNESS_GAMES.entries())
    expect(game.shared).toBe(TURN_GAME_DEFINITIONS[index]!);
});

test('each enrolled game shows the very client production registers', async () => {
  const { GAME_CLIENT_DEFINITIONS } = await import(
    '@libs/games-client-ts/game-plugins.client'
  );
  for (const game of HARNESS_GAMES)
    expect(
      game.client ===
        GAME_CLIENT_DEFINITIONS.find((client) => client.id === game.shared.id)
    ).toBe(true);
});

test('the shared suites run every registered game and only test-only games beside them', () => {
  const registered = new Set<unknown>(TURN_GAME_DEFINITIONS);
  expect(
    CONFORMANCE_GAMES.filter((game) => registered.has(game.shared))
  ).toEqual([...HARNESS_GAMES]);
  for (const game of CONFORMANCE_GAMES)
    expect(
      TURN_GAME_DEFINITIONS.some(
        (definition) => definition.id === game.shared.id
      )
    ).toBe(registered.has(game.shared));
});

// regression: puzzle-only-game-packages-look-unregistered
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
  // A puzzle-only game is registered too: its own id is its family.
  const registered = GAME_DEFINITIONS.map((game) =>
    isTurnGameDefinition(game) ? game.turnGame.rules : { id: game.id }
  );
  expect(packageFamilyProblems(registered, [...declared])).toEqual([]);
});

test('a game family owns several modes without duplicating its packages', () => {
  expect(
    packageFamilyProblems(
      [
        { id: 'race', family: 'counting' },
        { id: 'race-four', family: 'counting' },
      ],
      ['counting']
    )
  ).toEqual([]);
});

test('an unknown family cannot hide a mode without owning packages', () => {
  expect(
    packageFamilyProblems(
      [{ id: 'race-four', family: 'missing' }],
      ['counting']
    )
  ).toContain('race-four: game family missing has no package');
});

test('every mode of a shared family still needs its own conformance adapter', () => {
  const variants = TURN_GAME_DEFINITIONS.filter((mode) =>
    TURN_GAME_DEFINITIONS.some(
      (other) =>
        other.id !== mode.id &&
        gameFamily(other.turnGame.rules) === gameFamily(mode.turnGame.rules)
    )
  );
  expect(variants.length).toBeGreaterThan(1);
  for (const mode of variants) {
    const unregistered = TURN_GAME_DEFINITIONS.filter(
      (other) => other.id !== mode.id
    );
    expect(
      enrollmentProblems(unregistered, HARNESS_GAMES).some(
        (problem) =>
          problem.includes(`"${mode.id}"`) &&
          problem.includes('but not TURN_GAME_DEFINITIONS')
      )
    ).toBe(true);

    const omitted = HARNESS_GAMES.filter((game) => game.shared.id !== mode.id);
    expect(
      enrollmentProblems(TURN_GAME_DEFINITIONS, omitted).some((problem) =>
        problem.includes(
          `"${mode.id}" is in TURN_GAME_DEFINITIONS but not HARNESS_GAMES`
        )
      )
    ).toBe(true);
  }
});
