import { readGameSessionTime } from '@libs/game-session-harness-ts/game-session-clocks';
import { establishGameSession } from '@libs/game-session-harness-ts/game-session-lineup';
import { readGameSessionProbe } from '@libs/game-session-harness-ts/game-session-probe';
import { configureGameSessionChoice } from '@libs/game-session-harness-ts/game-session-ui';
import type { HarnessGame } from '@libs/game-session-harness-ts/harness-game';
import type { Measurement } from '@pkgs/openslo-shared-ts/evaluate';
import type { MeasureContext } from '@pkgs/openslo-shared-ts/registry';
import { bindObjectives } from '@pkgs/openslo-shared-ts/registry';
import { gamesHeldTo, openConformanceHarness } from '../conformance-world';
import { measuredChoice } from './game-session-choice-measure';

/** Accepted choices measured, shared out evenly among the games. */
const CHOICES = 100;

type Sample = { readonly atMs: number; readonly value: number };

/**
 * `choices` accepted choices in `game`'s game session, each measured on
 * the harness clock from the creator's choice until Bob's screen shows it.
 */
async function gameArrivals(
  game: HarnessGame,
  choices: number,
  endMs: number
): Promise<readonly Sample[]> {
  await using s = await openConformanceHarness();
  await s.apply(establishGameSession, game.shared.id, {
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
    const chosenAtMs = await s.read(readGameSessionTime);
    await s.apply(
      configureGameSessionChoice,
      'alice',
      measuredChoice(game, index)
    );
    const accepted = (await s.read(readGameSessionProbe, 'alice'))?.current;
    if (accepted === undefined || accepted === null)
      throw new Error(`${game.label}: an accepted choice has no game session`);
    let elapsed = 0;
    for (;;) {
      elapsed = (await s.read(readGameSessionTime)) - chosenAtMs;
      const received = (await s.read(readGameSessionProbe, 'bob'))?.current;
      if (
        received?.revision === accepted.revision &&
        received.fen === accepted.fen &&
        received.minutes === accepted.minutes &&
        received.increment === accepted.increment
      )
        break;
      if (elapsed >= 10_000) break;
      await s.advanceTime(5);
    }
    samples.push({ atMs: chosenAtMs, value: elapsed / 1000 });
  }
  const endedAtMs = await s.read(readGameSessionTime);
  return samples.map((sample) => ({
    atMs: endMs - (endedAtMs - sample.atMs),
    value: sample.value,
  }));
}

/** Accepted choices in every game offering game sessions, at least 100 in all. */
async function arrivals(context: MeasureContext): Promise<Measurement> {
  const games = gamesHeldTo('specs/games/game-session-delivery.openslo.yaml');
  const choices = Math.ceil(CHOICES / games.length);
  const samples: Sample[] = [];
  for (const game of games)
    samples.push(...(await gameArrivals(game, choices, context.endMs)));
  return { kind: 'samples', samples };
}

bindObjectives({
  spec: 'game-session-delivery',
  measure: { 'game-session-choice-arrival': arrivals },
  nowMs: () => Date.UTC(2026, 8, 28, 12),
});
