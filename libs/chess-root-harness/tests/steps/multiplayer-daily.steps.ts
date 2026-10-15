import { expect } from 'bun:test';
import {
  findChessOpponent,
  openMultiplayerChess,
} from '@libs/chess-matchmaking-harness/multiplayer-actions';
import { givenMultiplayerClock } from '@libs/chess-matchmaking-harness/multiplayer-fixtures';
import {
  multiplayerView,
  shownMultiplayerClockDays,
  shownMultiplayerText,
} from '@libs/chess-matchmaking-harness/multiplayer-reads';
import { passMultiplayerDays } from '@libs/chess-matchmaking-harness/multiplayer-time';
import { dailyTimeControlId } from '@libs/game-matchmaking-shared/time-control';
import { Given, Step, Then, When } from '@libs/harness/define';
import type { Actor } from '@libs/harness/parameter-types';
import type { HarnessWorld } from '@libs/harness/spec-world';
import { lastPieces } from './multiplayer-clock.steps';
import { acted, searchStep } from './multiplayer-find.steps';
import { matchedAs } from './multiplayer-matched.steps';
import { multiplayerPeople } from './multiplayer-people';
import { settledRating, stillRated } from './multiplayer-ratings.steps';
import {
  acceptedMoves,
  bothBoards,
  gameOf,
  givenBegunGame,
  givenGame,
  pairOf,
  refusal,
  searchFor,
  viewerOf,
} from './multiplayer-world';

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

/** A daily time control as people read it on their multiplayer screen. */
function daysPerMoveText(days: number): string {
  return days === 1 ? '1 day per move' : `${String(days)} days per move`;
}

// ------------------------------------------------------------ daily games

Given(
  '{actor} is White and {actor} is Black in a new daily game at {int} day(s) per move',
  (w, white: Actor, black: Actor, days: number) =>
    givenGame(w, white, black, dailyTimeControlId(days))
);
Given(
  '{actor} is White and {actor} is Black in a daily game at {int} day(s) per move after e4 and e5',
  (w, white: Actor, black: Actor, days: number) =>
    givenBegunGame(w, white, black, dailyTimeControlId(days))
);
Given(
  '{actor} is White and {actor} is Black in a daily game at {int} day(s) per move after f3, e5 and g4',
  async (w, white: Actor, black: Actor, days: number) => {
    await givenGame(w, white, black, dailyTimeControlId(days));
    await acceptedMoves(w, ['f2f3', 'e7e5', 'g2g4']);
  }
);
Given(
  '{actor} and {actor} have new accounts and a daily game at {int} day(s) per move after e4 and e5',
  (w, white: Actor, black: Actor, days: number) =>
    givenBegunGame(w, white, black, dailyTimeControlId(days))
);
Given(
  "{actor}'s multiplayer move e2 to e4 was accepted {int} day(s) after her daily game at {int} day(s) per move with {actor} started",
  async (w, ...[white, after, days, black]: [Actor, number, number, Actor]) => {
    await givenGame(w, white, black, dailyTimeControlId(days));
    await w.s.apply(passMultiplayerDays, after * DAY_MS);
    await acceptedMoves(w, ['e2e4']);
  }
);
Given(
  '{actor} has only his king left as Black in his daily game at {int} day(s) per move with {actor}',
  (w, black: Actor, days: number, white: Actor) =>
    lastPieces(
      w,
      { white, black },
      dailyTimeControlId(days),
      '4k3/8/8/8/8/8/8/R3K3 w - - 0 40'
    )
);
Given(
  "{actor} has {int} day(s) left on White's multiplayer clock on her turn",
  async (w, actor: Actor, days: number) => {
    const game = await gameOf(w, actor);
    await w.s.apply(givenMultiplayerClock, actor, {
      gameId: game.id,
      side: 'white',
      ms: days * DAY_MS,
    });
    await bothBoards(w, (g) => g.white_ms === days * DAY_MS);
  }
);

// ------------------------------------------------- daily time controls

When(
  '{actor} finds a chess opponent for {int} day(s) per move',
  async (w, actor: Actor, days: number) => {
    acted(w);
    await w.s.apply(findChessOpponent, actor, dailyTimeControlId(days));
  }
);
Step(
  '{actor} is looking for a {int} day(s) per move chess opponent',
  (w, actor: Actor, days: number) =>
    searchStep(w, actor, dailyTimeControlId(days))
);
Given(
  '{actor} and {actor} are looking for {int} day(s) per move chess opponents',
  async (w, first: Actor, second: Actor, days: number) => {
    await multiplayerPeople(w, [first, second]);
    await searchFor(w, first, dailyTimeControlId(days));
    await w.s.advanceTime(1);
    await searchFor(w, second, dailyTimeControlId(days));
  }
);
Then(
  '{actor} is told {int} day(s) per move is not an offered time control',
  (w, actor: Actor) => refusal(w, actor, 'CHESS_TIME_CONTROL_NOT_OFFERED')
);
Then(
  'both people see their multiplayer game is played at {int} day(s) per move',
  async (w, days: number) => {
    for (const actor of ['alice', 'bob']) {
      await w.s.apply(openMultiplayerChess, actor);
      await w.s.until(
        async (s) =>
          (await shownMultiplayerText(s, actor, 'multiplayer-time-control')) ===
          daysPerMoveText(days)
      );
      expect((await w.s.read(multiplayerView, actor)).game?.time_control).toBe(
        dailyTimeControlId(days)
      );
    }
  }
);
Then(
  '{actor} sees {actor} as their multiplayer opponent at {int} day(s) per move, with a daily rating of {string} and their colour',
  (w, ...[viewer, opponent, days, rating]: [Actor, Actor, number, string]) =>
    matchedAs(w, viewer, opponent, {
      timeControl: daysPerMoveText(days),
      rating,
    })
);

// ------------------------------------------------------- daily ratings

Given(
  '{actor} has a daily rating of {int}',
  (w, actor: Actor, rating: number) => settledRating(w, actor, 'daily', rating)
);
Then(
  "{actor}'s daily rating is still {int}",
  (w, actor: Actor, rating: number) => stillRated(w, actor, 'daily', rating)
);

// --------------------------------------------------------- daily clock

function passing(w: HarnessWorld, ms: number) {
  return w.s.apply(passMultiplayerDays, ms);
}

When('{int} day(s) pass(es) in multiplayer chess', (w, days: number) =>
  passing(w, days * DAY_MS)
);
Given('{int} day(s) has/have passed in multiplayer chess', (w, days: number) =>
  passing(w, days * DAY_MS)
);
When('{int} hour(s) pass(es) in multiplayer chess', (w, hours: number) =>
  passing(w, hours * HOUR_MS)
);

Then(
  "both people see {int} day(s) on White's multiplayer clock and {int} day(s) on Black's",
  async (w, white: number, black: number) => {
    for (const person of pairOf(w)) {
      const actor = viewerOf(w, person);
      await w.s.apply(openMultiplayerChess, actor);
      await w.s.until(
        async (s) =>
          (await shownMultiplayerClockDays(s, actor, 'white')) === white &&
          (await shownMultiplayerClockDays(s, actor, 'black')) === black,
        { maxMs: 500 }
      );
      expect([
        await w.s.read(shownMultiplayerClockDays, actor, 'white'),
        await w.s.read(shownMultiplayerClockDays, actor, 'black'),
      ]).toEqual([white, black]);
    }
  }
);
