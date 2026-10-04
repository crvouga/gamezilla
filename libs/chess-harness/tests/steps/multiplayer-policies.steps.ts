import { expect } from 'bun:test';
import {
  observeMembership,
  openBilling,
  providerEvent,
  subscribeToPlus,
} from '@libs/billing-harness/billing-actions';
import { billingTier } from '@libs/billing-harness/billing-reads';
import { showChessStatsScreen } from '@libs/chess-puzzle-harness/chess-actions';
import { readActivePuzzleId, readPuzzleDisplayFen, readStatsElo } from '@libs/chess-puzzle-harness/chess-puzzle-ui';
import { seedPuzzleRating } from '@libs/chess-puzzle-harness/chess-rating-data';
import { openMultiplayerChess } from '@libs/chess-matchmaking-harness/multiplayer-actions';
import { givenOpponentSearch } from '@libs/chess-matchmaking-harness/multiplayer-fixtures';
import { multiplayerRating, multiplayerText, multiplayerView } from '@libs/chess-matchmaking-harness/multiplayer-reads';
import { PUZZLE_RATING_DEFAULT_VOLATILITY_MICROS, PUZZLE_RATING_RD_MIN } from '@libs/chess-puzzle-shared/chess-puzzle-rating';
import {
  blockPerson,
  openPersonFromSearch,
} from '@libs/friends-harness/person-actions';
import { prepareNamedFriend } from '@libs/friends-harness/setup-friend-request';
import { focusActor } from '@libs/harness/shell-actions';
import type { Actor } from '@libs/harness/parameter-types';
import { Given, Then } from '@libs/harness/define';
import { joinViaLink } from '@libs/spaces-harness/space-actions';
import { readSpaceLink } from '@libs/spaces-harness/spaces-ui-reads';
import { multiplayerPeople } from './multiplayer-people';
import { givenGame } from './multiplayer-world';
import { enterPuzzles, waitSolverToMove } from './puzzle-world';

Given('{actor} blocked {actor}', async (w, actor: Actor, blocked: Actor) => {
  await prepareNamedFriend(w.s, actor);
  await prepareNamedFriend(w.s, blocked);
  await w.s.apply(openPersonFromSearch, actor, blocked);
  await w.s.apply(blockPerson, actor, blocked);
});
Given(
  '{actor} blocked {actor} after their multiplayer game was formed',
  async (w, actor: Actor, blocked: Actor) => {
    await givenGame(w, actor, blocked);
    await prepareNamedFriend(w.s, actor);
    await prepareNamedFriend(w.s, blocked);
    await w.s.apply(openPersonFromSearch, actor, blocked);
    await w.s.apply(blockPerson, actor, blocked);
  }
);
Then(
  '{actor} and {actor} are still looking for other chess opponents',
  async (w, a: Actor, b: Actor) => {
    for (const actor of [a, b]) {
      expect((await w.s.read(multiplayerView, actor)).search?.standing).toBe(
        'waiting'
      );
      expect((await w.s.read(multiplayerView, actor)).game).toBeNull();
    }
  }
);
Then(
  '{actor} is not told {actor} blocked him',
  async (w, actor: Actor, blocker: Actor) => {
    await w.s.apply(openMultiplayerChess, actor);
    const text = await w.s.read(multiplayerText, actor, 'multiplayer-waiting');
    expect(text).not.toContain('block');
    expect(text).not.toContain(blocker);
  }
);
Given('{actor} is a Plus member with a connection', async (w, actor: Actor) => {
  await multiplayerPeople(w, [actor]);
  await w.s.apply(openBilling, actor);
  await w.s.apply(subscribeToPlus, actor);
  await w.s.until(async (s) => (await billingTier(s, actor)) === 'paid');
});
Given(
  '{actor} no longer has paid access while she was looking for a chess opponent',
  async (w, actor: Actor) => {
    await multiplayerPeople(w, [actor]);
    await w.s.apply(openBilling, actor);
    await w.s.apply(subscribeToPlus, actor);
    await w.s.apply(givenOpponentSearch, actor);
    await w.s.apply(observeMembership, actor, 'period_end');
    await w.s.apply(providerEvent, actor, 'refund');
    await w.s.apply(openBilling, actor);
    await w.s.until(async (s) => (await billingTier(s, actor)) === 'free');
  }
);
Then(
  '{actor} is still looking for a chess opponent',
  async (w, actor: Actor) => {
    expect((await w.s.read(multiplayerView, actor)).search?.standing).toBe(
      'waiting'
    );
  }
);
Given(
  '{actor} and {actor} are playing a puzzle in a space',
  async (w, host: Actor, watcher: Actor) => {
    await prepareNamedFriend(w.s, host);
    await multiplayerPeople(w, [watcher]);
    await enterPuzzles(w, host);
    await waitSolverToMove(w, host);
    const puzzleId = await w.s.read(readActivePuzzleId, host);
    const puzzleFen = await w.s.read(readPuzzleDisplayFen, host);
    const link = await w.s.read(readSpaceLink, host);
    if (link === null) throw new Error('Puzzle host has no space link');
    await w.s.apply(joinViaLink, watcher, link);
    await w.s.until(
      async (s) =>
        (await readActivePuzzleId(s, watcher)) === puzzleId &&
        (await readPuzzleDisplayFen(s, watcher)) === puzzleFen
    );
    w.memo.set('multiplayer:unrelated-puzzle', [
      await w.s.read(readActivePuzzleId, watcher),
      await w.s.read(readPuzzleDisplayFen, watcher),
    ]);
  }
);
Then('{actor} keeps the same puzzle in the space', async (w, actor: Actor) => {
  await w.s.apply(focusActor, actor);
  expect([
    await w.s.read(readActivePuzzleId, actor),
    await w.s.read(readPuzzleDisplayFen, actor),
  ]).toEqual(w.memo.get('multiplayer:unrelated-puzzle') as [string, string]);
});
Given(
  '{actor} has a puzzle rating of {int} and an unfinished multiplayer game',
  async (w, actor: Actor, rating: number) => {
    await givenGame(w, actor, 'bob');
    await w.s.apply(seedPuzzleRating, actor, {
      rating,
      ratingDeviation: PUZZLE_RATING_RD_MIN,
      volatilityMicros: PUZZLE_RATING_DEFAULT_VOLATILITY_MICROS,
    });
  }
);
Then(
  "{actor}'s puzzle rating is still {int}",
  async (w, actor: Actor, rating: number) => {
    await w.s.apply(showChessStatsScreen, actor);
    expect(await w.s.read(readStatsElo, actor)).toBe(rating);
  }
);
Then(
  "{actor}'s multiplayer rating is still {int}",
  async (w, actor: Actor, rating: number) => {
    expect(await w.s.read(multiplayerRating, actor)).toBe(rating);
  }
);
