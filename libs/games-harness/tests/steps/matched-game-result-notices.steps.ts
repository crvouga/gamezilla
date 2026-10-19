/**
 * A daily game's result notices, whichever game it is: both people get one
 * saying whether it was won, lost, drawn or aborted for them and why; each
 * keeps theirs until they dismiss it, and opening it shows the daily game.
 */

import { expect } from 'bun:test';
import { closeApp } from '@libs/game-matchmaking-harness/matched-game-app.steps';
import {
  acceptedMoves,
  command,
  gameCommand,
  resignation,
} from '@libs/game-matchmaking-harness/matched-game-world';
import { multiplayerView } from '@libs/game-matchmaking-harness/multiplayer-reads';
import { Given, Then, When } from '@libs/harness/define';
import type { HarnessWorld } from '@libs/harness/spec-world';
import { daily } from './finding-an-opponent-world';
import { gameOf } from './game-world';
import { finishedAt, firstMoves, pairedAt } from './matched-game';
import { deviceOffline } from './matched-game-connection';
import type { NoticeWanted } from './matched-game-notice-world';
import {
  noticeGame,
  noticePerson,
  noticesAfter,
  noticesWithin,
  openNotice,
} from './matched-game-notice-world';
import { openOn } from './matched-game-shown.steps';

/** The daily clock choice of a game the scenario does not name one for. */
const UNNAMED_DAYS = 3;

/** Reasons the platform itself ends a matched game with, not the game's rules. */
const PLATFORM_REASONS = new Set([
  'resignation',
  'timeout',
  'agreement',
  'abort',
  'first move missed',
  'account deletion',
]);

/**
 * Why the scenario says the daily game ended, as the result notice carries
 * it. The game's own rules are whatever reason its finished board shows,
 * which is none of the platform's own.
 */
async function reasonWanted(
  w: HarnessWorld,
  person: string,
  why: string
): Promise<Partial<NoticeWanted>> {
  if (why === 'resignation') return { reason: 'resignation' };
  if (why === 'agreement') return { reason: 'agreement' };
  if (why === 'the first side running out of time')
    return { reason: 'timeout', flaggedSide: 'white' };
  if (why !== "the game's own rules")
    throw new Error(`Unknown result reason ${why}`);
  const game = await w.s.until(
    async (s) => (await multiplayerView(s, person)).game,
    { pred: (seen) => seen !== null && seen.outcome !== 'ongoing' }
  );
  const shown = game?.reason ?? null;
  expect(shown === null || PLATFORM_REASONS.has(shown)).toBe(false);
  return { reason: (reason) => reason === shown };
}

Then(
  "{actor}'s inbox shows within {int} seconds a result notice of a daily game {word} against {actor} by {}",
  async (
    w,
    ...[actor, seconds, result, opponent, why]: [
      string,
      number,
      string,
      string,
      string,
    ]
  ) =>
    noticesWithin(w, actor, {
      kind: 'result',
      opponent,
      result,
      ...(await reasonWanted(w, await noticePerson(w, actor), why)),
      count: 1,
      seconds,
    })
);
Then(
  "{actor}'s inbox shows within {int} seconds a result notice of an aborted daily game against {actor}",
  (w, actor: string, seconds: number, opponent: string) =>
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
  (w, actor: string, seconds: number) =>
    noticesAfter(w, actor, { kind: 'result', count: 0, seconds })
);
Then(
  "{actor}'s inbox stops showing the result notice of their daily game against {actor} within {int} seconds",
  (w, actor: string, _opponent: string, seconds: number) =>
    noticesWithin(w, actor, { kind: 'result', count: 0, seconds })
);
Then(
  "{actor}'s inbox still shows the result notice of their daily game against {actor} after {int} seconds",
  (w, actor: string, opponent: string, seconds: number) =>
    noticesAfter(w, actor, { kind: 'result', opponent, count: 1, seconds })
);

Given(
  '{actor} has a result notice of a daily game won against {actor}',
  async (w, actor: string, opponent: string) => {
    await finishedAt(w, actor, opponent, daily(UNNAMED_DAYS));
    await noticesWithin(w, actor, {
      kind: 'result',
      opponent,
      result: 'won',
      count: 1,
      seconds: 15,
    });
    // Back from the inbox to the space the finished game was played in.
    await openOn(w, actor);
  }
);
Given(
  '{actor} has offered {actor} a draw in their daily game at {int} day(s) per move',
  async (w, offerer: string, offered: string, days: number) => {
    await pairedAt(w, offerer, offered, daily(days));
    expect(
      (await gameCommand(w, offerer, 'offerMultiplayerDraw')).result.ok
    ).toBe(true);
  }
);
Given(
  "{actor} has the first side against {actor} in a daily game at {int} day(s) per move one move from a draw by the game's own rules",
  async (w, first: string, second: string, days: number) => {
    const line = gameOf(w).fixtures.drawByRules;
    if (line === undefined)
      throw new Error(`${gameOf(w).label} names no line its rules draw`);
    await pairedAt(w, first, second, daily(days));
    await acceptedMoves(w, line.slice(0, -1));
  }
);

When('{actor} dismisses her/his result notice', async (w, actor: string) => {
  await command(w, actor, 'dismissMultiplayerResultNotice', {
    gameId: noticeGame(w).id,
  });
});
When('{actor} opens her/his result notice', (w, actor: string) =>
  openNotice(w, actor, 'result')
);

/** The second side resigns the begun daily game while the first is away. */
async function resignedWhileAway(
  w: HarnessWorld,
  people: { readonly away: string; readonly resigner: string },
  days: number,
  leave: (w: HarnessWorld, actor: string) => Promise<void>
) {
  await pairedAt(w, people.away, people.resigner, daily(days));
  await firstMoves(w);
  await leave(w, people.away);
  expect((await resignation(w, people.resigner)).result.ok).toBe(true);
}

Given(
  "{actor}'s phone was offline when {actor} resigned their daily game at {int} day(s) per move",
  (w, away: string, resigner: string, days: number) =>
    resignedWhileAway(w, { away, resigner }, days, deviceOffline)
);
Given(
  "{actor}'s app was closed when {actor} resigned their daily game at {int} day(s) per move",
  (w, away: string, resigner: string, days: number) =>
    resignedWhileAway(w, { away, resigner }, days, closeApp)
);
