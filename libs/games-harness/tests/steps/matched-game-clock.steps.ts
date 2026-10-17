/**
 * A matched game's clocks, as both people see them: seconds outside a daily
 * game, days in one, and a victory on time once a clock runs out.
 */

import { expect } from 'bun:test';
import {
  acceptedMoves,
  bothBoards,
  ownerOf,
  pairOf,
  sameBoards,
  viewerOf,
  winner,
} from '@libs/game-matchmaking-harness/matched-game-world';
import {
  shownMultiplayerClock,
  shownMultiplayerClockDays,
} from '@libs/game-matchmaking-harness/multiplayer-reads';
import { passMultiplayerDays } from '@libs/game-matchmaking-harness/multiplayer-time';
import { openFindingAnOpponent } from '@libs/game-matchmaking-harness/opponent-seeking';
import { Given, Then, When } from '@libs/harness/define';
import type { HarnessWorld } from '@libs/harness/spec-world';
import { daily } from './finding-an-opponent-world';
import { gameOf } from './game-world';
import { firstMoveOf, firstMoves, pairedAt } from './matched-game';

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

type ClockRead = typeof shownMultiplayerClock;

/** Both people see `first` and `second` on the sides' clocks, read by `read`. */
async function clocksSeen(
  w: HarnessWorld,
  read: ClockRead,
  first: number,
  second: number
) {
  for (const person of pairOf(w)) {
    const device = viewerOf(w, person);
    await w.s.apply(openFindingAnOpponent, device, gameOf(w).shared.id);
    await w.s.until(
      async (s) =>
        (await read(s, device, 'white')) === first &&
        (await read(s, device, 'black')) === second,
      { maxMs: 500 }
    );
    expect([
      await w.s.read(read, device, 'white'),
      await w.s.read(read, device, 'black'),
    ]).toEqual([first, second]);
  }
}

function passing(w: HarnessWorld, ms: number) {
  return w.s.apply(passMultiplayerDays, ms);
}

Given(
  '{actor} has the first side against {actor} in a new {word} matched game',
  (w, first: string, second: string, clock: string) =>
    pairedAt(w, first, second, clock)
);
Given(
  '{actor} has the first side against {actor} in a new daily game at {int} day(s) per move',
  (w, first: string, second: string, days: number) =>
    pairedAt(w, first, second, daily(days))
);
Given(
  '{actor} has the first side against {actor} in a daily game at {int} day(s) per move after their first moves',
  async (w, first: string, second: string, days: number) => {
    await pairedAt(w, first, second, daily(days));
    await firstMoves(w);
  }
);
Given(
  '{actor} made her first move {int} days into her new daily game at {int} days per move with {actor}',
  async (
    w,
    ...[first, after, days, second]: [string, number, number, string]
  ) => {
    await pairedAt(w, first, second, daily(days));
    await passing(w, after * DAY_MS);
    await acceptedMoves(w, [firstMoveOf(w, first)]);
  }
);
Given('{int} day(s) has/have passed', (w, days: number) =>
  passing(w, days * DAY_MS)
);

When('{int} day(s) pass(es)', (w, days: number) => passing(w, days * DAY_MS));
When('{int} hour(s) pass(es)', (w, hours: number) =>
  passing(w, hours * HOUR_MS)
);

Then(
  "both people see {int} seconds on the first side's clock and {int} seconds on the second side's",
  (w, first: number, second: number) =>
    clocksSeen(w, shownMultiplayerClock, first, second)
);
Then(
  "both people see {int} day(s) on the first side's clock and {int} day(s) on the second side's",
  (w, first: number, second: number) =>
    clocksSeen(w, shownMultiplayerClockDays, first, second)
);
Then(
  'both people see {actor} won the matched game on time',
  async (w, actor: string) => {
    await winner(w, actor, 'timeout');
    const game = await bothBoards(w);
    const won = game.white_id === (await ownerOf(w, actor)) ? 'white' : 'black';
    expect(won === 'white' ? game.black_ms : game.white_ms).toBe(0);
  }
);
Then(
  '{actor} sees he won the matched game on time',
  async (w, actor: string) => {
    const owner = await ownerOf(w, actor);
    const game = await sameBoards(
      w,
      actor,
      actor,
      (g) => g.outcome !== 'ongoing'
    );
    expect(game.outcome).toBe(game.white_id === owner ? 'white' : 'black');
    expect(game.reason).toBe('timeout');
  }
);
