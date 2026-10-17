import { expect } from 'bun:test';
import type {
  MultiplayerNoticeKind,
  ShownMultiplayerNotice,
} from '@libs/chess-matchmaking-harness/multiplayer-notices';
import {
  openMultiplayerNotice,
  shownMultiplayerNotices,
} from '@libs/chess-matchmaking-harness/multiplayer-notices';
import { ownerOf } from '@libs/game-matchmaking-harness/matched-game-world';
import { multiplayerView } from '@libs/game-matchmaking-harness/multiplayer-reads';
import { passMultiplayerTime } from '@libs/game-matchmaking-harness/multiplayer-time';
import type { MultiplayerGame } from '@libs/game-matchmaking-shared/game-state';
import type { HarnessWorld } from '@libs/harness/spec-world';

const SECOND_MS = 1000;

/** `White` and `Black` name whoever plays that colour in Alice and Bob's game. */
export async function noticePerson(w: HarnessWorld, actor: string) {
  if (actor !== 'white' && actor !== 'black') return actor;
  await w.s.until(
    async (s) => (await multiplayerView(s, 'alice')).game !== null
  );
  const game = (await w.s.read(multiplayerView, 'alice')).game!;
  const whiteIsAlice = game.white_id === (await ownerOf(w, 'alice'));
  return (actor === 'white') === whiteIsAlice ? 'alice' : 'bob';
}

export type NoticeWanted = {
  readonly kind: MultiplayerNoticeKind;
  /** The multiplayer opponent it names; any when left out. */
  readonly opponent?: string;
  readonly unread?: boolean;
  /** A turn notice that is, or is not, a turn reminder. */
  readonly reminder?: boolean;
  /** Words the notice has to say, such as the time left. */
  readonly says?: string;
  readonly result?: string;
  readonly reason?: string;
  readonly flaggedSide?: string;
};

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
        (wanted.reason === undefined || notice.reason === wanted.reason) &&
        (wanted.flaggedSide === undefined ||
          notice.flaggedSide === wanted.flaggedSide)
    ).length;
}

/** The person's inbox comes to show exactly this many such notices in time. */
export async function noticesWithin(
  w: HarnessWorld,
  actor: string,
  wanted: NoticeWanted & { readonly count: number; readonly seconds: number }
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
  wanted: NoticeWanted & { readonly count: number; readonly seconds: number }
) {
  const person = await noticePerson(w, actor);
  const count = await matching(w, wanted);
  await w.s.apply(passMultiplayerTime, wanted.seconds * SECOND_MS);
  expect(count(await w.s.read(shownMultiplayerNotices, person))).toBe(
    wanted.count
  );
}

/**
 * The person opens the notice from their inbox. The board their device held
 * just before is its last known multiplayer board.
 */
export async function openNotice(
  w: HarnessWorld,
  actor: string,
  kind: MultiplayerNoticeKind
) {
  if (!w.memo.has(`multiplayer:offline-board:${actor}`))
    w.memo.set(
      `multiplayer:offline-board:${actor}`,
      (await w.s.read(multiplayerView, actor)).game
    );
  await w.s.apply(openMultiplayerNotice, actor, kind);
}

/** The scenario's game, whatever either person's screen shows now. */
export function noticeGame(w: HarnessWorld): MultiplayerGame {
  return w.memo.get('multiplayer:game') as MultiplayerGame;
}
