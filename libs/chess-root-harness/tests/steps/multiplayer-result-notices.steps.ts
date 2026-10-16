import { expect } from 'bun:test';
import { openMultiplayerChess } from '@libs/chess-matchmaking-harness/multiplayer-actions';
import { dailyTimeControlId } from '@libs/game-matchmaking-shared/time-control';
import { Given, Then, When } from '@libs/harness/define';
import type { Actor } from '@libs/harness/parameter-types';
import type { HarnessWorld } from '@libs/harness/spec-world';
import { closeApp } from './multiplayer-app.steps';
import { disconnectMultiplayer } from './multiplayer-connection';
import { REPETITION } from './multiplayer-draw.steps';
import type { NoticeWanted } from './multiplayer-notice-world';
import {
  noticeGame,
  noticesAfter,
  noticesWithin,
  openNotice,
} from './multiplayer-notice-world';
import {
  acceptedMoves,
  command,
  givenBegunGame,
  givenGame,
  givenOverGame,
  resignation,
} from './multiplayer-world';

/** The daily time control of a game the scenario does not name one for. */
const UNNAMED_DAYS = 3;

/** Why the scenario says the daily game ended, as the result notice carries it. */
const REASONS: Readonly<Record<string, Partial<NoticeWanted>>> = {
  'White running out of time': { reason: 'timeout', flaggedSide: 'white' },
  checkmate: { reason: 'checkmate' },
  resignation: { reason: 'resignation' },
  repetition: { reason: 'repetition' },
};

Then(
  "{actor}'s inbox shows within {int} seconds a result notice of a daily game {word} against {actor} by {}",
  (
    w,
    ...[actor, seconds, result, opponent, why]: [
      Actor,
      number,
      string,
      Actor,
      string,
    ]
  ) => {
    const reason = REASONS[why];
    if (reason === undefined) throw new Error(`Unknown result reason ${why}`);
    return noticesWithin(w, actor, {
      kind: 'result',
      opponent,
      result,
      ...reason,
      count: 1,
      seconds,
    });
  }
);
Then(
  "{actor}'s inbox shows within {int} seconds a result notice of an aborted daily game against {actor}",
  (w, actor: Actor, seconds: number, opponent: Actor) =>
    noticesWithin(w, actor, {
      kind: 'result',
      opponent,
      result: 'aborted',
      count: 1,
      seconds,
    })
);
Then(
  "{actor}'s inbox still shows no result notice after {int} seconds",
  (w, actor: Actor, seconds: number) =>
    noticesAfter(w, actor, { kind: 'result', count: 0, seconds })
);
Then(
  "{actor}'s inbox stops showing the result notice of their daily game against {actor} within {int} seconds",
  (w, actor: Actor, _opponent: Actor, seconds: number) =>
    noticesWithin(w, actor, { kind: 'result', count: 0, seconds })
);
Then(
  "{actor}'s inbox still shows the result notice of their daily game against {actor} after {int} seconds",
  (w, actor: Actor, opponent: Actor, seconds: number) =>
    noticesAfter(w, actor, { kind: 'result', opponent, count: 1, seconds })
);

Given(
  '{actor} has a result notice of a daily game won against {actor}',
  async (w, actor: Actor, opponent: Actor) => {
    await givenOverGame(w, actor, opponent, dailyTimeControlId(UNNAMED_DAYS));
    await noticesWithin(w, actor, {
      kind: 'result',
      opponent,
      result: 'won',
      count: 1,
      seconds: 15,
    });
    // Back from the inbox to the space the finished game was played in.
    await w.s.apply(openMultiplayerChess, actor);
  }
);
Given(
  '{actor} and {actor} have a daily game at {int} day(s) per move with a position one move from its third appearance',
  async (w, white: Actor, black: Actor, days: number) => {
    await givenGame(w, white, black, dailyTimeControlId(days));
    await acceptedMoves(w, REPETITION.slice(0, 7));
    w.memo.set('multiplayer:boundary-move', [black, 'f6g8']);
  }
);

When('{actor} dismisses their result notice', async (w, actor: Actor) => {
  await command(w, actor, 'dismissMultiplayerResultNotice', {
    gameId: noticeGame(w).id,
  });
});
When('{actor} opens their result notice', (w, actor: Actor) =>
  openNotice(w, actor, 'result')
);

/** Black resigns the begun daily game while White is away from it. */
async function resignedWhileAway(
  w: HarnessWorld,
  people: { readonly away: string; readonly resigner: string },
  days: number,
  leave: (w: HarnessWorld, actor: string) => Promise<void>
) {
  await givenBegunGame(
    w,
    people.away,
    people.resigner,
    dailyTimeControlId(days)
  );
  await leave(w, people.away);
  expect((await resignation(w, people.resigner)).result.ok).toBe(true);
}

Given(
  "{actor}'s phone was offline when {actor} resigned multiplayer chess in their daily game at {int} day(s) per move",
  (w, away: Actor, resigner: Actor, days: number) =>
    resignedWhileAway(w, { away, resigner }, days, disconnectMultiplayer)
);
Given(
  "{actor}'s app was closed when {actor} resigned multiplayer chess in their daily game at {int} day(s) per move",
  (w, away: Actor, resigner: Actor, days: number) =>
    resignedWhileAway(w, { away, resigner }, days, closeApp)
);
