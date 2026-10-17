import { expect } from 'bun:test';
import type { ShownMultiplayerNotice } from '@libs/chess-matchmaking-harness/multiplayer-notices';
import {
  givenOpenedTurnNotice,
  heldMultiplayerNotices,
} from '@libs/chess-matchmaking-harness/multiplayer-notices';
import { acceptedMoves } from '@libs/game-matchmaking-harness/matched-game-world';
import { passMultiplayerDays } from '@libs/game-matchmaking-harness/multiplayer-time';
import { dailyTimeControlId } from '@libs/game-matchmaking-shared/time-control';
import { Given, Then } from '@libs/harness/define';
import type { Actor } from '@libs/harness/parameter-types';
import type { HarnessWorld } from '@libs/harness/spec-world';
import { disconnectMultiplayer } from './multiplayer-connection';
import {
  noticeGame,
  noticesAfter,
  noticesWithin,
} from './multiplayer-notice-world';
import { givenBegunGame } from './multiplayer-world';

const DAY_MS = 86_400_000;

/** Time left as a turn reminder words it. */
const hoursLeft = (hours: number): string =>
  hours === 1 ? '1 hour' : `${String(hours)} hours`;
const daysLeft = (days: number): string =>
  days === 1 ? '1 day' : `${String(days)} days`;

type TurnNoticeHeld = {
  readonly unread?: boolean;
  readonly reminder?: boolean;
};

/** The person's device comes to hold one turn notice that is as named. */
async function turnNoticeHeld(
  w: HarnessWorld,
  actor: string,
  wanted: TurnNoticeHeld
) {
  const held = (notices: readonly ShownMultiplayerNotice[]) => {
    const turn = notices.filter((notice) => notice.kind === 'turn');
    return (
      turn.length === 1 &&
      (wanted.unread === undefined || turn[0]?.unread === wanted.unread) &&
      (wanted.reminder === undefined || turn[0]?.reminder === wanted.reminder)
    );
  };
  await w.s.until((s) => heldMultiplayerNotices(s, actor), { pred: held });
  expect(held(await w.s.read(heldMultiplayerNotices, actor))).toBe(true);
}

/** The person opened the turn notice they hold, so it is no longer unread. */
async function openedTurnNotice(w: HarnessWorld, actor: string) {
  await turnNoticeHeld(w, actor, {});
  await w.s.apply(givenOpenedTurnNotice, actor, noticeGame(w).id);
  await turnNoticeHeld(w, actor, { unread: false });
}

/**
 * A daily game after e4 and e5 in which White, to move, has only the named
 * days left: the days before that have passed.
 */
async function whiteLowOnTime(
  w: HarnessWorld,
  people: { readonly white: string; readonly black: string },
  days: { readonly perMove: number; readonly left: number }
) {
  await givenBegunGame(
    w,
    people.white,
    people.black,
    dailyTimeControlId(days.perMove)
  );
  await w.s.apply(passMultiplayerDays, (days.perMove - days.left) * DAY_MS);
}

function reminderWithin(
  w: HarnessWorld,
  people: { readonly actor: string; readonly opponent: string },
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

Given('{actor} has opened their turn notice', openedTurnNotice);
Given(
  '{actor} opened their turn reminder with {int} day(s) left in their daily game at {int} day(s) per move with {actor}',
  async (
    w,
    ...[white, left, perMove, black]: [Actor, number, number, Actor]
  ) => {
    await whiteLowOnTime(w, { white, black }, { perMove, left });
    await turnNoticeHeld(w, white, { unread: true, reminder: true });
    await openedTurnNotice(w, white);
  }
);
Given(
  '{actor} got a turn reminder on an earlier turn of their daily game at {int} day(s) per move with {actor}, and it is their turn again',
  async (w, white: Actor, perMove: number, black: Actor) => {
    await whiteLowOnTime(w, { white, black }, { perMove, left: 1 });
    await turnNoticeHeld(w, white, { unread: true, reminder: true });
    await acceptedMoves(w, ['g1f3', 'b8c6']);
    await turnNoticeHeld(w, white, { unread: true, reminder: false });
  }
);
Given(
  "{actor}'s phone was offline when their turn notice became a turn reminder with {int} day(s) left in their daily game at {int} day(s) per move with {actor}",
  async (
    w,
    ...[white, left, perMove, black]: [Actor, number, number, Actor]
  ) => {
    await givenBegunGame(w, white, black, dailyTimeControlId(perMove));
    await turnNoticeHeld(w, white, { reminder: false });
    await disconnectMultiplayer(w, white);
    await w.s.apply(passMultiplayerDays, (perMove - left) * DAY_MS);
  }
);

Then(
  "{actor}'s inbox shows one unread turn reminder with {int} hour(s) left for their daily game with {actor} within {int} seconds",
  (w, ...[actor, hours, opponent, seconds]: [Actor, number, Actor, number]) =>
    reminderWithin(w, { actor, opponent }, hoursLeft(hours), seconds)
);
Then(
  "{actor}'s inbox shows one unread turn reminder with {int} day(s) left for their daily game with {actor} within {int} seconds",
  (w, ...[actor, days, opponent, seconds]: [Actor, number, Actor, number]) =>
    reminderWithin(w, { actor, opponent }, daysLeft(days), seconds)
);
Then(
  "{actor}'s inbox still shows no turn reminder after {int} seconds",
  (w, actor: Actor, seconds: number) =>
    noticesAfter(w, actor, { kind: 'turn', reminder: true, count: 0, seconds })
);
