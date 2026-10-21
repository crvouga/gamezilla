/**
 * A daily game's turn notices and turn reminders, whichever game it is: the
 * person to move holds one, it comes back unread on their next turn and as a
 * turn reminder when they are low on time, and it leaves with their move.
 */

import { expect } from 'bun:test';
import { closeApp } from '@libs/game-matchmaking-harness-ts/matched-game-app.steps';
import {
  acceptedMoves,
  move,
} from '@libs/game-matchmaking-harness-ts/matched-game-world';
import {
  givenOpenedTurnNotice,
  shownMultiplayerNotices,
} from '@libs/game-matchmaking-harness-ts/multiplayer-notices';
import { multiplayerView } from '@libs/game-matchmaking-harness-ts/multiplayer-reads';
import { passMultiplayerDays } from '@libs/game-matchmaking-harness-ts/multiplayer-time';
import { Given, Then, When } from '@libs/harness-ts/define';
import type { HarnessWorld } from '@libs/harness-ts/spec-world';
import { daily } from './finding-an-opponent-world';
import { gameOf } from './game-world';
import {
  firstMoveOf,
  firstMoves,
  pairedAt,
  victoryMoveAt,
} from './matched-game';
import { deviceOffline } from './matched-game-connection';
import {
  noticeGame,
  noticesAfter,
  noticesWithin,
  openNotice,
  turnNoticeHeld,
} from './matched-game-notice-world';

const DAY_MS = 86_400_000;

type People = { readonly actor: string; readonly opponent: string };

function turnNoticeWithin(w: HarnessWorld, people: People, seconds: number) {
  return noticesWithin(w, people.actor, {
    kind: 'turn',
    opponent: people.opponent,
    count: 1,
    seconds,
  });
}

Then(
  "the {gameSide}'s inbox shows a turn notice for their daily game with the {gameSide} within {int} seconds",
  (w, actor: string, opponent: string, seconds: number) =>
    turnNoticeWithin(w, { actor, opponent }, seconds)
);
Then(
  "{actor}'s inbox shows a turn notice for their daily game with {actor} within {int} seconds",
  (w, actor: string, opponent: string, seconds: number) =>
    turnNoticeWithin(w, { actor, opponent }, seconds)
);
Then(
  "{actor}'s inbox shows one unread turn notice for their daily game with {actor} within {int} seconds",
  (w, actor: string, opponent: string, seconds: number) =>
    noticesWithin(w, actor, {
      kind: 'turn',
      opponent,
      unread: true,
      count: 1,
      seconds,
    })
);
Then(
  "{actor}'s inbox stops showing the turn notice for their daily game with {actor} within {int} seconds",
  (w, actor: string, _opponent: string, seconds: number) =>
    noticesWithin(w, actor, { kind: 'turn', count: 0, seconds })
);
Then(
  "the {gameSide}'s inbox still shows no turn notice after {int} seconds",
  (w, actor: string, seconds: number) =>
    noticesAfter(w, actor, { kind: 'turn', count: 0, seconds })
);
Then(
  "{actor}'s inbox still shows no turn notice after {int} seconds",
  (w, actor: string, seconds: number) =>
    noticesAfter(w, actor, { kind: 'turn', count: 0, seconds })
);
Then(
  "{actor}'s inbox still shows one turn notice for their daily game with {actor} after {int} seconds",
  (w, actor: string, opponent: string, seconds: number) =>
    noticesAfter(w, actor, { kind: 'turn', opponent, count: 1, seconds })
);
Then(
  "{actor}'s inbox still shows one unread turn notice for their daily game with {actor} after {int} seconds",
  (w, actor: string, opponent: string, seconds: number) =>
    noticesAfter(w, actor, {
      kind: 'turn',
      opponent,
      unread: true,
      count: 1,
      seconds,
    })
);
Then(
  "{actor}'s turn notice names {username} as their opponent",
  async (w, actor: string, username: string) => {
    const named = (
      shown: Awaited<ReturnType<typeof shownMultiplayerNotices>>
    ) =>
      shown.some(
        (notice) =>
          notice.kind === 'turn' && notice.text.includes(`@${username}`)
      );
    await w.s.until((s) => shownMultiplayerNotices(s, actor), { pred: named });
    expect(named(await w.s.read(shownMultiplayerNotices, actor))).toBe(true);
  }
);
Then("{actor}'s turn notice is no longer unread", async (w, actor: string) => {
  const opened = (shown: Awaited<ReturnType<typeof shownMultiplayerNotices>>) =>
    shown.some((notice) => notice.kind === 'turn' && !notice.unread);
  await w.s.until((s) => shownMultiplayerNotices(s, actor), { pred: opened });
  expect(opened(await w.s.read(shownMultiplayerNotices, actor))).toBe(true);
});

When('{actor} opens their turn notice', (w, actor: string) =>
  openNotice(w, actor, 'turn')
);
Given(
  '{actor} opened his/her turn notice before making his/her first move',
  async (w, actor: string) => {
    await w.s.apply(givenOpenedTurnNotice, actor, noticeGame(w).id);
  }
);
Given(
  '{actor} has the first side against {actor} in a daily game at {int} day(s) per move one move from her victory',
  async (w, first: string, second: string, days: number) => {
    await pairedAt(w, first, second, daily(days));
    const victory = gameOf(w).fixtures.firstSideVictory;
    await acceptedMoves(w, victory.slice(0, -1));
    w.memo.set('winning-move', victory.at(-1));
  }
);

/** The first side's first move is accepted while the second side is away. */
async function firstMoveWhileAway(
  w: HarnessWorld,
  people: { readonly away: string; readonly mover: string },
  days: number,
  leave: (w: HarnessWorld, actor: string) => Promise<void>
) {
  await pairedAt(w, people.mover, people.away, daily(days));
  await leave(w, people.away);
  expect(
    (await move(w, people.mover, firstMoveOf(w, people.mover))).result.ok
  ).toBe(true);
  await w.s.until(async (s) => (await multiplayerView(s, people.mover)).game, {
    pred: (game) => game?.revision === 1,
  });
}

Given(
  "{actor}'s phone was offline when {actor}'s first move in their daily game at {int} day(s) per move was accepted",
  (w, away: string, mover: string, days: number) =>
    firstMoveWhileAway(w, { away, mover }, days, deviceOffline)
);
Given(
  "{actor}'s app was closed when {actor}'s first move in their daily game at {int} day(s) per move was accepted",
  (w, away: string, mover: string, days: number) =>
    firstMoveWhileAway(w, { away, mover }, days, closeApp)
);

// --- Turn reminders --------------------------------------------------------

/** Time left as a turn reminder words it. */
const hoursLeft = (hours: number): string =>
  hours === 1 ? '1 hour' : `${String(hours)} hours`;
const daysLeft = (days: number): string =>
  days === 1 ? '1 day' : `${String(days)} days`;

/** The person opened the turn notice they hold, so it is no longer unread. */
async function openedTurnNotice(w: HarnessWorld, actor: string) {
  await turnNoticeHeld(w, actor, {});
  await w.s.apply(givenOpenedTurnNotice, actor, noticeGame(w).id);
  await turnNoticeHeld(w, actor, { unread: false });
}

/**
 * A daily game after both first moves in which the first side, to move, has
 * only the named days left: the days before that have passed.
 */
async function firstSideLowOnTime(
  w: HarnessWorld,
  people: { readonly first: string; readonly second: string },
  days: { readonly perMove: number; readonly left: number }
) {
  await pairedAt(w, people.first, people.second, daily(days.perMove));
  await firstMoves(w);
  await w.s.apply(passMultiplayerDays, (days.perMove - days.left) * DAY_MS);
}

function reminderWithin(
  w: HarnessWorld,
  people: People,
  left: string,
  seconds: number
) {
  return noticesWithin(w, people.actor, {
    kind: 'turn',
    opponent: people.opponent,
    unread: true,
    reminder: true,
    says: `${left} left`,
    count: 1,
    seconds,
  });
}

Given('{actor} has opened her/his turn notice', openedTurnNotice);
Given(
  '{actor} opened her turn reminder with {int} day(s) left in her daily game at {int} day(s) per move with {actor}',
  async (
    w,
    ...[first, left, perMove, second]: [string, number, number, string]
  ) => {
    await firstSideLowOnTime(w, { first, second }, { perMove, left });
    await turnNoticeHeld(w, first, { unread: true, reminder: true });
    await openedTurnNotice(w, first);
  }
);
Given(
  '{actor} got a turn reminder on an earlier turn of her daily game at {int} day(s) per move with {actor}, and it is her turn again',
  async (w, first: string, perMove: number, second: string) => {
    await firstSideLowOnTime(w, { first, second }, { perMove, left: 1 });
    await turnNoticeHeld(w, first, { unread: true, reminder: true });
    await acceptedMoves(w, [victoryMoveAt(w, 2), victoryMoveAt(w, 3)]);
    await turnNoticeHeld(w, first, { unread: true, reminder: false });
  }
);
Given(
  "{actor}'s phone was offline when her turn notice became a turn reminder with {int} day(s) left in her daily game at {int} day(s) per move with {actor}",
  async (
    w,
    ...[first, left, perMove, second]: [string, number, number, string]
  ) => {
    await pairedAt(w, first, second, daily(perMove));
    await firstMoves(w);
    await turnNoticeHeld(w, first, { reminder: false });
    await deviceOffline(w, first);
    await w.s.apply(passMultiplayerDays, (perMove - left) * DAY_MS);
  }
);

Then(
  "{actor}'s inbox shows one unread turn reminder with {int} hour(s) left for their daily game with {actor} within {int} seconds",
  (w, ...[actor, hours, opponent, seconds]: [string, number, string, number]) =>
    reminderWithin(w, { actor, opponent }, hoursLeft(hours), seconds)
);
Then(
  "{actor}'s inbox shows one unread turn reminder with {int} day(s) left for their daily game with {actor} within {int} seconds",
  (w, ...[actor, days, opponent, seconds]: [string, number, string, number]) =>
    reminderWithin(w, { actor, opponent }, daysLeft(days), seconds)
);
Then(
  "{actor}'s inbox still shows no turn reminder after {int} seconds",
  (w, actor: string, seconds: number) =>
    noticesAfter(w, actor, { kind: 'turn', reminder: true, count: 0, seconds })
);
