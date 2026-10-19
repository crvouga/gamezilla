/**
 * A person's rating at each speed of the run's game, as their finding an
 * opponent shows it (`1500?` until it settles), and the rated matched games
 * behind it.
 */

import { expect } from 'bun:test';
import {
  bothBoards,
  pairOf,
  resignation,
} from '@libs/game-matchmaking-harness/matched-game-world';
import { givenMultiplayerRating } from '@libs/game-matchmaking-harness/multiplayer-fixtures';
import {
  multiplayerView,
  shownMultiplayerText,
} from '@libs/game-matchmaking-harness/multiplayer-reads';
import { openFindingAnOpponent } from '@libs/game-matchmaking-harness/opponent-seeking';
import { MULTIPLAYER_SETTLED_GAMES } from '@libs/game-matchmaking-shared/multiplayer-rating';
import type { ClockSpeed } from '@libs/game-matchmaking-shared/time-control';
import { gameSpeed } from '@libs/game-matchmaking-shared/time-control';
import { Given, Then } from '@libs/harness/define';
import type { HarnessWorld } from '@libs/harness/spec-world';
import { daily } from './finding-an-opponent-world';
import { gameOf } from './game-world';
import { firstMoves, pairedAt, readyPeople } from './matched-game';

const RISE = 'matched-game:rating-rise';

/** The run's game's clock namespace, where its ratings are kept. */
function namespace(w: HarnessWorld): string {
  const matchmaking = gameOf(w).shared.turnGame.capabilities.matchmaking;
  if (matchmaking === undefined)
    throw new Error(`${gameOf(w).label} offers no finding an opponent`);
  return matchmaking.clockNamespace;
}

/** A settled rating at `speed`: enough rated matched games to lose its "?". */
async function settled(
  w: HarnessWorld,
  actor: string,
  speed: ClockSpeed,
  rating: number
) {
  await readyPeople(w, [actor]);
  await w.s.apply(
    givenMultiplayerRating,
    actor,
    gameSpeed(namespace(w), speed),
    {
      rating,
      games: MULTIPLAYER_SETTLED_GAMES,
    }
  );
}

/** What `actor`'s finding an opponent shows of their `speed` rating. */
async function shown(
  w: HarnessWorld,
  actor: string,
  speed: string,
  part: 'value' | 'games' = 'value'
) {
  await w.s.apply(openFindingAnOpponent, actor, gameOf(w).shared.id);
  return (
    (await w.s.read(
      shownMultiplayerText,
      actor,
      `multiplayer-rating-${speed}-${part}`
    )) ?? ''
  ).trim();
}

/** The rating `actor` sees at `speed` once it satisfies `ok`. */
async function shownOnce(
  w: HarnessWorld,
  actor: string,
  speed: string,
  ok: (rating: string) => boolean
) {
  await w.s.apply(openFindingAnOpponent, actor, gameOf(w).shared.id);
  await w.s.until(async (s) =>
    ok(
      (
        (await shownMultiplayerText(
          s,
          actor,
          `multiplayer-rating-${speed}-value`
        )) ?? ''
      ).trim()
    )
  );
  return shown(w, actor, speed);
}

const points = (rating: string) => Number(rating.replace('?', ''));

/** Both people of the pairing are new: no rating at any speed yet. */
async function newAccounts(w: HarnessWorld) {
  for (const person of pairOf(w))
    expect((await w.s.read(multiplayerView, person)).ratings).toEqual([]);
}

Given(
  '{actor} has a {word} rating of {int}',
  (w, actor: string, speed: ClockSpeed, rating: number) =>
    settled(w, actor, speed, rating)
);
Given(
  '{actor} has a {word} rating of {int} and a {word} rating of {int}',
  async (
    w,
    ...[actor, a, ra, b, rb]: [string, ClockSpeed, number, ClockSpeed, number]
  ) => {
    await settled(w, actor, a, ra);
    await settled(w, actor, b, rb);
  }
);
Given(
  "{actor}'s blitz rating is one rated matched game from settling",
  async (w, actor: string) => {
    await readyPeople(w, [actor]);
    await w.s.apply(
      givenMultiplayerRating,
      actor,
      gameSpeed(namespace(w), 'blitz'),
      {
        rating: 1500,
        games: MULTIPLAYER_SETTLED_GAMES - 1,
      }
    );
  }
);
Given(
  '{actor} and {actor} have new accounts and a {word} matched game after their first moves',
  async (w, first: string, second: string, clock: string) => {
    await pairedAt(w, first, second, clock);
    await newAccounts(w);
    await firstMoves(w);
  }
);
Given(
  '{actor} and {actor} have new accounts and a daily game at {int} day(s) per move after their first moves',
  async (w, first: string, second: string, days: number) => {
    await pairedAt(w, first, second, daily(days));
    await newAccounts(w);
    await firstMoves(w);
  }
);
Given(
  '{actor} resigned the matched game and {actor} won',
  async (w, loser: string) => {
    expect((await resignation(w, loser)).result.ok).toBe(true);
    await bothBoards(w, (g) => g.outcome !== 'ongoing');
  }
);

Then(
  '{actor} sees her blitz rating without the "?"',
  async (w, actor: string) => {
    expect(
      await shownOnce(w, actor, 'blitz', (r) => r !== '' && !r.endsWith('?'))
    ).not.toContain('?');
  }
);
Then(
  '{actor}\'s blitz rating is still shown with the "?"',
  async (w, actor: string) => {
    expect(await shown(w, actor, 'blitz')).toEndWith('?');
  }
);
Then(
  '{actor} sees her {word} rating rise above {int}',
  async (w, actor: string, speed: string, base: number) => {
    const rating = await shownOnce(w, actor, speed, (r) => points(r) > base);
    expect(points(rating)).toBeGreaterThan(base);
    w.memo.set(RISE, points(rating) - base);
  }
);
Then(
  '{actor} sees his blitz rating fall below {int} by the same amount',
  async (w, actor: string, base: number) => {
    const rating = await shownOnce(w, actor, 'blitz', (r) => points(r) < base);
    expect(base - points(rating)).toBe(Number(w.memo.get(RISE)));
  }
);
Then(
  "{actor}'s {word} rating is still {int}",
  async (w, actor: string, speed: string, rating: number) => {
    expect(points(await shown(w, actor, speed))).toBe(rating);
  }
);
Then(
  '{actor} still has {int} rated matched game at {word}',
  async (w, actor: string, games: number, speed: string) => {
    expect(await shown(w, actor, speed, 'games')).toBe(
      `${String(games)} rated game${games === 1 ? '' : 's'}`
    );
  }
);
