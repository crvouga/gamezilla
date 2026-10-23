/**
 * A daily game's turn notices, turn reminders and result notices as each
 * person's inbox shows them, whichever game it is: the notices of one kind
 * that say what a scenario names, counted within or after some seconds.
 */

import { expect } from 'bun:test';
import {
  ownerOf,
  pairOf,
} from '@libs/game-matchmaking-harness-ts/matched-game-world';
import type {
  MultiplayerNoticeKind,
  ShownMultiplayerNotice,
} from '@libs/game-matchmaking-harness-ts/multiplayer-notices';
import {
  heldMultiplayerNotices,
  openMultiplayerNotice,
  shownMultiplayerNotices,
} from '@libs/game-matchmaking-harness-ts/multiplayer-notices';
import { multiplayerView } from '@libs/game-matchmaking-harness-ts/multiplayer-reads';
import { passMultiplayerTime } from '@libs/game-matchmaking-harness-ts/multiplayer-time';
import type { MultiplayerGame } from '@libs/game-matchmaking-shared-ts/game-state';
import type { HarnessWorld } from '@libs/harness-ts/spec-world';
import { rememberLastKnownBoard } from './matched-game-connection';

const SECOND_MS = 1000;

/**
 * The person a step names: a person, or `white` / `black` for whoever was
 * given the first or second side when the two people were paired.
 */
export async function noticePerson(w: HarnessWorld, actor: string) {
  if (actor !== 'white' && actor !== 'black') return actor;
  const [first, second] = pairOf(w);
  const game = await w.s.until(
    async (s) => (await multiplayerView(s, first)).game,
    { pred: (seen) => seen !== null }
  );
  const firstHasFirstSide = game?.white_id === (await ownerOf(w, first));
  return (actor === 'white') === firstHasFirstSide ? first : second;
}

export type NoticeWanted = {
  readonly kind: MultiplayerNoticeKind;
  /** The opponent it names; any when left out. */
  readonly opponent?: string;
  readonly unread?: boolean;
  /** A turn notice that is, or is not, a turn reminder. */
  readonly reminder?: boolean;
  /** Words the notice has to say, such as the time left. */
  readonly says?: string;
  readonly result?: string;
  /** The reason it gives, or whether that reason passes this test. */
  readonly reason?: string | ((reason: string | null) => boolean);
  readonly flaggedSide?: string;
};

function reasonMatches(
  wanted: NoticeWanted['reason'],
  reason: string | null
): boolean {
  if (wanted === undefined) return true;
  return typeof wanted === 'function' ? wanted(reason) : reason === wanted;
}

/** The inbox's notices of this kind that say what the scenario names. */
async function matching(
  w: HarnessWorld,
  wanted: NoticeWanted
): Promise<(shown: readonly ShownMultiplayerNotice[]) => number> {
  const opponentId =
    wanted.opponent === undefined
      ? undefined
      : await ownerOf(w, await noticePerson(w, wanted.opponent));
  return (shown) =>
    shown.filter(
      (notice) =>
        notice.kind === wanted.kind &&
        (opponentId === undefined || notice.opponentUserId === opponentId) &&
        (wanted.unread === undefined || notice.unread === wanted.unread) &&
        (wanted.reminder === undefined ||
          notice.reminder === wanted.reminder) &&
        (wanted.says === undefined || notice.text.includes(wanted.says)) &&
        (wanted.result === undefined || notice.result === wanted.result) &&
        reasonMatches(wanted.reason, notice.reason) &&
        (wanted.flaggedSide === undefined ||
          notice.flaggedSide === wanted.flaggedSide)
    ).length;
}

type Counted = NoticeWanted & {
  readonly count: number;
  readonly seconds: number;
};

/** The person's inbox comes to show exactly this many such notices in time. */
export async function noticesWithin(
  w: HarnessWorld,
  actor: string,
  wanted: Counted
) {
  const person = await noticePerson(w, actor);
  const count = await matching(w, wanted);
  await w.s.until((s) => shownMultiplayerNotices(s, person), {
    pred: (shown) => count(shown) === wanted.count,
    maxMs: wanted.seconds * SECOND_MS,
  });
  expect(count(await w.s.read(shownMultiplayerNotices, person))).toBe(
    wanted.count
  );
}

/** Seconds later, the sweep included, the inbox still shows this many. */
export async function noticesAfter(
  w: HarnessWorld,
  actor: string,
  wanted: Counted
) {
  const person = await noticePerson(w, actor);
  const count = await matching(w, wanted);
  await w.s.apply(passMultiplayerTime, wanted.seconds * SECOND_MS);
  expect(count(await w.s.read(shownMultiplayerNotices, person))).toBe(
    wanted.count
  );
}

type TurnNoticeHeld = {
  readonly unread?: boolean;
  readonly reminder?: boolean;
};

/** The person's device comes to hold one turn notice that is as named. */
export async function turnNoticeHeld(
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

/**
 * The person opens the notice from their inbox. The board their device held
 * just before is its last known board.
 */
export async function openNotice(
  w: HarnessWorld,
  actor: string,
  kind: MultiplayerNoticeKind
) {
  await rememberLastKnownBoard(w, actor);
  await w.s.apply(openMultiplayerNotice, actor, kind);
}

/** The scenario's game, whatever either person's screen shows now. */
export function noticeGame(w: HarnessWorld): MultiplayerGame {
  const game = w.memo.get('multiplayer:game') as MultiplayerGame | undefined;
  if (game === undefined) throw new Error('No matched game was set up');
  return game;
}
