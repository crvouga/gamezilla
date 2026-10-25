import { readCustomGameTime } from '@libs/game-session-harness-ts/custom-game-clocks';
import { establishCustomGame } from '@libs/game-session-harness-ts/custom-game-lineup';
import { readCustomGameProbe } from '@libs/game-session-harness-ts/custom-game-probe';
import { configureCustomGameChoice } from '@libs/game-session-harness-ts/custom-game-ui';
import type { HarnessGame } from '@libs/game-session-harness-ts/harness-game';
import type { CustomGameInput } from '@libs/game-session-shared-ts/custom-game-choice';
import type { Measurement } from '@pkgs/openslo-shared-ts/evaluate';
import type { MeasureContext } from '@pkgs/openslo-shared-ts/registry';
import { bindObjectives } from '@pkgs/openslo-shared-ts/registry';
import { gamesHeldTo, openConformanceHarness } from '../conformance-world';

/** Accepted choices measured, shared out evenly among the games. */
const CHOICES = 100;

type Sample = { readonly atMs: number; readonly value: number };

/**
 * The `index`th choice measured in `game`: a turn clock, alternating its
 * increment, where the game has one, and otherwise its own game options.
 */
function choiceAt(game: HarnessGame, index: number): CustomGameInput {
  // regression: games-bindings-assume-clocked-turn-games
  const options = game.configurationChoices;
  if (game.shared.turnGame === undefined && options !== undefined)
    return { operation: 'rules', choice: options[index % 2]! };
  return { operation: 'clock', minutes: 1, increment: index % 2 === 0 ? 2 : 0 };
}

/**
 * `choices` accepted choices in `game`'s custom game, each measured on
 * the harness clock from the creator's choice until Bob's screen shows it.
 */
async function gameArrivals(
  game: HarnessGame,
  choices: number,
  endMs: number
): Promise<readonly Sample[]> {
  await using s = await openConformanceHarness(
    `custom-game-choice-arrivals-${game.shared.id}`
  );
  await s.apply(establishCustomGame, game.shared.id, {
    host: 'alice',
    first: 'alice',
    second: 'open',
    watchers: ['bob'],
    ready: false,
    active: false,
  });
  const samples: Sample[] = [];
  for (let index = 0; index < choices; index += 1) {
    // Include acknowledgement time so settling the writer cannot hide delivery.
    const chosenAtMs = await s.read(readCustomGameTime);
    await s.apply(configureCustomGameChoice, 'alice', choiceAt(game, index));
    const chosen = (await s.read(readCustomGameProbe, 'alice'))?.current;
    if (chosen == null)
      throw new Error(`${game.label}: an accepted choice has no custom game`);
    let elapsed = 0;
    for (;;) {
      elapsed = (await s.read(readCustomGameTime)) - chosenAtMs;
      const received = (await s.read(readCustomGameProbe, 'bob'))?.current;
      if (
        received?.revision === chosen.revision &&
        received.fen === chosen.fen &&
        received.minutes === chosen.minutes &&
        received.increment === chosen.increment
      )
        break;
      if (elapsed >= 10_000) break;
      await s.advanceTime(5);
    }
    samples.push({ atMs: chosenAtMs, value: elapsed / 1000 });
  }
  const endedAtMs = await s.read(readCustomGameTime);
  return samples.map((sample) => ({
    atMs: endMs - (endedAtMs - sample.atMs),
    value: sample.value,
  }));
}

/** Accepted choices in every game offering custom games, at least 100 in all. */
async function arrivals(context: MeasureContext): Promise<Measurement> {
  const games = gamesHeldTo('specs/games/custom-game-delivery.openslo.yaml');
  const choices = Math.ceil(CHOICES / games.length);
  const samples: Sample[] = [];
  for (const game of games)
    samples.push(...(await gameArrivals(game, choices, context.endMs)));
  return { kind: 'samples', samples };
}

bindObjectives({
  spec: 'custom-game-delivery',
  measure: { 'custom-game-choice-arrival': arrivals },
  nowMs: () => Date.UTC(2026, 8, 28, 12),
});
