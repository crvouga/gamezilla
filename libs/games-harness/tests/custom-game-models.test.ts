/**
 * The custom-game models hold for every game offering custom games: each is
 * replayed once per such game, every such game's known victory is one the
 * models can follow, and the configuration model keeps its proof strategy.
 */

import { expect, test } from 'bun:test';
import { join } from 'node:path';
import {
  offersAll,
  sharedSpecificationNeeds,
} from '@libs/games-harness/game-conformance';
import {
  DEFAULT_VERIFY_STEPS,
  DEFAULT_VERIFY_TIMEOUT_MS,
  quintBinding,
  traceVariants,
} from '@pkgs/quint-shared/registry';
import { CONFORMANCE_GAMES } from './conformance-world';
import './quint/index';
import { VICTORY_MOVES, victoryOf } from './quint/model-game';

const MODELS = [
  ...new Bun.Glob('*.qnt').scanSync(
    join(import.meta.dir, '../../../specs/games')
  ),
]
  .filter((file) => file !== 'events.qnt')
  .sort();

test('every shared model replays once for each game offering what it shows', () => {
  expect(MODELS.length).toBeGreaterThan(0);
  for (const file of MODELS) {
    const specUri = `specs/games/${file}`;
    const variants = traceVariants({
      model: file.replace(/\.qnt$/, ''),
      specUri,
    });
    expect(variants?.map((variant) => variant.id)).toEqual(
      CONFORMANCE_GAMES.filter((game) =>
        offersAll(game, sharedSpecificationNeeds(specUri))
      ).map((game) => game.shared.id)
    );
  }
});

test('every game offering custom games shows a victory the models can follow', () => {
  for (const game of CONFORMANCE_GAMES.filter((candidate) =>
    offersAll(candidate, ['custom-games'])
  ))
    expect(victoryOf(game)).toHaveLength(VICTORY_MOVES);
});

test('a victory of another length is refused with what the models need', () => {
  const [game] = CONFORMANCE_GAMES;
  if (game === undefined) throw new Error('No conformance game');
  const shorter = {
    ...game,
    fixtures: {
      ...game.fixtures,
      firstSideVictory: game.fixtures.firstSideVictory.slice(0, 5),
    },
  };
  expect(() => victoryOf(shorter)).toThrow(
    `follow a first-side victory of exactly ${String(VICTORY_MOVES)} moves`
  );
});

test('custom game keeps its complete induction proof within the original bounds', () => {
  // regression: custom-game-proof-solver-timeout
  const binding = quintBinding('custom-game');
  expect(binding.inductiveInvariant).toBe('_inductive');
  expect(binding.separateInduction).toBe(true);
  expect(binding.inductionCaseGroupSize).toBe(8);
  expect(binding.invariantMode).toBe('before');
  expect(binding.verifySteps ?? DEFAULT_VERIFY_STEPS).toBe(4);
  expect(binding.verifyTimeoutMs ?? DEFAULT_VERIFY_TIMEOUT_MS).toBe(240_000);
});
