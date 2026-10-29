/**
 * Conformance never depends on the order games are listed or checked in:
 * the plan and matrix are the same row for row with the games reversed, a
 * game's laws give the same verdict whichever games stand beside it and
 * whichever game's laws ran first, and a faulty game is refused by the same
 * laws either way. Bounded: the reference game and its faulty copies are
 * cheap to check; the registered games stand beside them.
 */

import { expect, test } from 'bun:test';
import { join } from 'node:path';
import type { GameLaw } from '@libs/game-session-harness-ts/game-rules-laws';
import { gameRulesLaws } from '@libs/game-session-harness-ts/game-rules-laws';
import type { HarnessGame } from '@libs/game-session-harness-ts/harness-game';
import type { ConformanceRow } from '@libs/games-harness-ts/game-conformance';
import {
  planConformance,
  SHARED_SPECIFICATION_KINDS,
  SHARED_SPECIFICATIONS,
} from '@libs/games-harness-ts/game-conformance';
import { HARNESS_GAMES } from '@libs/games-harness-ts/harness-games';
import { PLAYABLE_GAME_DEFINITIONS } from '@libs/games-shared-ts/game-plugins';
import { planCodeSuites } from './conformance/game-suite';
import { CONFORMANCE_GAMES } from './conformance-world';
import {
  COUNTING_RACE_GAME,
  COUNTING_RACE_RULES,
} from './reference-game/counting-race-game';
import { definedWith } from './reference-game/faulty-game';

const SPECS = [
  ...new Bun.Glob('*').scanSync(join(import.meta.dir, '../../../specs/games')),
]
  .filter((file) =>
    SHARED_SPECIFICATION_KINDS.some((kind) => file.endsWith(kind))
  )
  .filter((file) => file !== 'events.qnt')
  .sort()
  .map((file) => `specs/games/${file}`);

const byGame = (rows: readonly ConformanceRow[]) =>
  Object.fromEntries(rows.map((row) => [row.game, row.cells]));

test('the plan and matrix are the same with the games in reverse order', async () => {
  const codeSuites = await planCodeSuites(import.meta.dir);
  const plan = (games: readonly HarnessGame[]) =>
    planConformance({
      registered: PLAYABLE_GAME_DEFINITIONS,
      harness: HARNESS_GAMES,
      games,
      codeSuites,
      specifications: SPECS,
      table: SHARED_SPECIFICATIONS,
    });
  const forward = plan(CONFORMANCE_GAMES);
  const reversed = plan([...CONFORMANCE_GAMES].reverse());
  expect(byGame(reversed.matrix)).toEqual(byGame(forward.matrix));
  expect([...reversed.problems].sort()).toEqual([...forward.problems].sort());
});

/** Which of `laws` hold, by name, checked in the order given. */
function verdicts(laws: readonly GameLaw[]): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const law of laws)
    try {
      law.check();
      out[law.name] = true;
    } catch {
      out[law.name] = false;
    }
  return out;
}

test("a game's rules laws give one verdict whichever games stand beside it, in any order", () => {
  const faulty = definedWith({
    rules: { ...COUNTING_RACE_RULES, recognizes: () => true },
  });
  for (const game of [COUNTING_RACE_GAME, faulty]) {
    const forward = verdicts(gameRulesLaws(game, HARNESS_GAMES));
    const reversed = verdicts(
      gameRulesLaws(game, [...HARNESS_GAMES].reverse())
    );
    expect(reversed).toEqual(forward);
  }
  // The faulty game is refused either way, and the sound one never.
  expect(
    Object.values(verdicts(gameRulesLaws(COUNTING_RACE_GAME, HARNESS_GAMES)))
  ).not.toContain(false);
  expect(
    verdicts(gameRulesLaws(faulty, [...HARNESS_GAMES].reverse()))[
      'every position a game reaches is recognized as this game alone'
    ]
  ).toBe(false);
}, 60_000);

test("a game's verdict does not depend on which game's laws ran first", () => {
  const faulty = definedWith({
    rules: { ...COUNTING_RACE_RULES, moves: () => [] },
  });
  const soundFirst = [
    verdicts(gameRulesLaws(COUNTING_RACE_GAME, HARNESS_GAMES)),
    verdicts(gameRulesLaws(faulty, HARNESS_GAMES)),
  ];
  const faultyFirst = [
    verdicts(gameRulesLaws(faulty, HARNESS_GAMES)),
    verdicts(gameRulesLaws(COUNTING_RACE_GAME, HARNESS_GAMES)),
  ].reverse();
  expect(faultyFirst).toEqual(soundFirst);
}, 60_000);

test('each faulty copy is its own game: defining one leaves the reference game and the others untouched', () => {
  const before = COUNTING_RACE_GAME.shared.turnGame;
  const copy = definedWith({
    rules: { ...COUNTING_RACE_RULES, legal: () => [] },
  });
  expect(copy.shared).not.toBe(COUNTING_RACE_GAME.shared);
  expect(COUNTING_RACE_GAME.shared.turnGame).toBe(before);
  expect(COUNTING_RACE_GAME.shared.turnGame.rules.legal('race:0w')).toEqual([
    'advance',
    'leap',
    'hop',
  ]);
});
