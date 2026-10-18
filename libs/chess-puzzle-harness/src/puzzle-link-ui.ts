/**
 * Puzzle links as people use them: "Share puzzle link" on the puzzle screen
 * copies the link; opening a link goes to it as a tapped link would; the
 * link's screen says why a puzzle cannot open.
 */

import {
  puzzleIdOfLink,
  puzzleLink,
  puzzleLinkPathOf,
} from '@libs/game-puzzle-shared/puzzle-link';
import {
  isPuzzleLimitShown,
  isPuzzleOfflineNoticeShown,
  readPuzzleOnBoard,
} from '@libs/game-session-harness/puzzle-screen';
import {
  actorUi,
  ensureActor,
  pollUntil,
  scenarioAction,
} from '@libs/harness/actor-ui';
import type { ProductHarness } from '@libs/harness/harness';
import { bringToFront } from '@libs/harness/observations';
import { Handles } from '@libs/test-ids-shared/handles';
import type { RecordingClipboard } from '@pkgs/device-shared/clipboard';
import { hostLimit } from '@pkgs/gherkin-shared/registry';

const WAIT_MS = 15_000;
const POLL_MS = 100;

async function clipboardOf(
  s: ProductHarness,
  actorId: string
): Promise<RecordingClipboard> {
  const env = await s.harness.client(actorId);
  const clipboard = env.clipboard as Partial<RecordingClipboard>;
  if (typeof clipboard.last !== 'function') {
    throw hostLimit('this host does not show what a person copied');
  }
  return clipboard as RecordingClipboard;
}

/** The puzzle link to `puzzleId`, as the app shares it. */
export function puzzleLinkTo(puzzleId: string): string {
  return puzzleLink(null, puzzleId);
}

/** What the actor last copied, or null before anything was. */
export async function readCopiedText(
  s: ProductHarness,
  actorId: string
): Promise<string | null> {
  return (await clipboardOf(s, actorId)).last();
}

/** The puzzle link the actor last copied, and the puzzle it opens. */
export async function readSharedPuzzleLink(
  s: ProductHarness,
  actorId: string
): Promise<{ readonly link: string; readonly puzzleId: string } | null> {
  const link = await readCopiedText(s, actorId);
  if (link === null) return null;
  const puzzleId = puzzleIdOfLink(link);
  return puzzleId === null ? null : { link, puzzleId };
}

/** Press "Share puzzle link" and wait until the link is copied. */
export const sharePuzzleLink = scenarioAction({
  name: 'sharePuzzleLink',
  act: async (s, actorId: string) => {
    const clipboard = await clipboardOf(s, actorId);
    const before = clipboard.writes.length;
    const ui = await actorUi(s, actorId);
    await ui.get(Handles.chessPuzzleShareLink).tap({ timeoutMs: WAIT_MS });
    await pollUntil(
      s,
      async () => (clipboard.writes.length > before ? true : null),
      { maxMs: WAIT_MS, stepMs: POLL_MS, description: 'puzzle link copied' }
    );
  },
});

/** Open a puzzle link on the actor's device, as tapping it would. */
export const openPuzzleLink = scenarioAction({
  name: 'openPuzzleLink',
  act: async (s, actorId: string, link: string) => {
    const path = puzzleLinkPathOf(link);
    if (path === null) throw new Error(`not a puzzle link: ${link}`);
    await ensureActor(s, actorId);
    const actor = s.actors.get(actorId);
    if (actor === undefined) throw new Error(`${actorId} has no device`);
    await actor.openLink(path);
    await s.session.waitForIdle();
  },
});

/** The puzzle link's screen says the puzzle is no longer available. */
export async function isPuzzleLinkUnavailableVisible(
  s: ProductHarness,
  actorId: string
): Promise<boolean> {
  const ui = await actorUi(s, actorId);
  return ui.get(Handles.chessPuzzleLinkUnavailable).isVisible();
}

/** What opening a puzzle link came to on the opener's screen. */
export type PuzzleLinkOutcome =
  | 'linked'
  | 'dailyLimit'
  | 'unavailable'
  | 'offline'
  | 'other';

/**
 * Where the opener's screen stands with the linked `puzzleId`: on the
 * board, or what they are told instead; `other` while it is still opening.
 */
export async function readPuzzleLinkOutcome(
  s: ProductHarness,
  actorId: string,
  puzzleId: string
): Promise<PuzzleLinkOutcome> {
  // The opener's screen, brought in view to be read.
  await bringToFront(s, actorId);
  if (await isPuzzleLinkUnavailableVisible(s, actorId)) return 'unavailable';
  if (await isPuzzleOfflineNoticeShown(s, actorId)) return 'offline';
  if (await isPuzzleLimitShown(s, actorId)) return 'dailyLimit';
  return (await readPuzzleOnBoard(s, actorId)) === puzzleId
    ? 'linked'
    : 'other';
}
