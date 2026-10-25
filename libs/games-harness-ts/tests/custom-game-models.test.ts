/**
 * The custom-game models hold for every game offering custom games: each is
 * replayed once per such game, every such game's known victory is one the
 * models can follow, and the configuration model keeps its proof strategy.
 */

import { expect, test } from 'bun:test';
import { join } from 'node:path';
import {
  playedRulesOf,
  recordedLine,
  splitDealtPosition,
} from '@libs/game-session-harness-ts/played-rules';
import {
  offersAll,
  sharedSpecificationNeeds,
} from '@libs/games-harness-ts/game-conformance';
import {
  DEFAULT_VERIFY_STEPS,
  DEFAULT_VERIFY_TIMEOUT_MS,
  quintBinding,
  traceVariants,
} from '@pkgs/quint-shared-ts/registry';
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
    expect(victoryOf(game).length).toBeGreaterThanOrEqual(VICTORY_MOVES);
  // The whole-victory models follow exactly the seven moves.
  for (const game of CONFORMANCE_GAMES.filter((candidate) =>
    offersAll(candidate, ['custom-games', 'a seven-move victory'])
  ))
    expect(victoryOf(game)).toHaveLength(VICTORY_MOVES);
});

// regression: private-setup-model-victory-as-proposed
test('the models compare moves with the victory as the game records it', () => {
  for (const game of CONFORMANCE_GAMES.filter((candidate) =>
    offersAll(candidate, ['custom-games'])
  )) {
    const victory = victoryOf(game);
    const recorded = recordedLine(game, victory);
    const rules = game.shared.turnGame.rules;
    // Played as recorded, the line is the victory its authority plays.
    expect(rules.replay(recorded, recorded.length)).toBe(
      splitDealtPosition(
        playedRulesOf(game).replay([...victory], victory.length)
      ).position
    );
    if (rules.setup === undefined && rules.hands === undefined)
      expect(recorded).toEqual([...victory]);
    else expect(recorded).not.toEqual([...victory]);
  }
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
    `follow a first-side victory of at least ${String(VICTORY_MOVES)} moves`
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
