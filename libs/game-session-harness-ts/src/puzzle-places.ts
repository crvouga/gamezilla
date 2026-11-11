/**
 * The puzzle feed's small screens as a person moves between them, for any
 * game offering puzzles: which place the screen is on (the play screen's
 * shell names its stage and place), and the ways from one to another — the
 * row or control that opens a place, and Back to the place behind it. A
 * driver that needs a control on another place comes here to reach it.
 */

import { actorUi, pollUntil } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { Handles } from '@libs/test-ids-shared-ts/handles';

const WAIT_MS = 15_000;
const POLL_MS = 100;

/** The row of the feed settings that opens each setting's own place. */
export const FEED_SETTING_ROW = {
  'feed-target': 'chess-puzzle-feed-row-target',
  'feed-history': 'chess-puzzle-feed-row-history',
  'feed-themes': Handles.chessPuzzleFeedThemeTrigger,
  'feed-advance': 'chess-puzzle-feed-row-advance',
} as const;

/** One setting of the feed, each on a place of its own. */
export type FeedSettingPlace = keyof typeof FEED_SETTING_ROW;

/** On the board: the control that opens the line's own place. */
const LINE_OPEN = 'chess-puzzle-line-open';

/** Where the feed stands and which of its small screens shows. */
export type PuzzlePlaceSeen = {
  /** `loading`, `offline`, `limited`, `empty`, `waiting`, `playing`, `finished`. */
  readonly stage: string;
  /** `status`, `play`, `line`, `result`, `feed`, `feed-target`, … */
  readonly place: string;
};

/** The place the actor's puzzle screen is on, or null off the puzzles. */
export async function readPuzzlePlace(
  s: ProductHarness,
  actorId: string
): Promise<PuzzlePlaceSeen | null> {
  const ui = await actorUi(s, actorId);
  const shell = ui.get(Handles.chessPuzzlePlayScreen);
  if (!(await shell.isVisible())) return null;
  const stage = await shell.attribute('data-stage');
  const place = await shell.attribute('data-place');
  return stage === null || place === null ? null : { stage, place };
}

/** Whether `place` is the feed settings or one of their settings. */
function isFeedPlace(place: string): boolean {
  return place === 'feed' || place.startsWith('feed-');
}

/** A stage's home: the place Back leaves the puzzles from. */
function isHomePlace(place: string): boolean {
  return place === 'status' || place === 'play' || place === 'result';
}

async function waitPlace(
  s: ProductHarness,
  actorId: string,
  wanted: (seen: PuzzlePlaceSeen) => boolean,
  description: string
): Promise<PuzzlePlaceSeen> {
  return pollUntil(
    s,
    async () => {
      const seen = await readPuzzlePlace(s, actorId);
      return seen !== null && wanted(seen) ? seen : null;
    },
    { maxMs: WAIT_MS, stepMs: POLL_MS, description }
  );
}

/** One step back, as the back control does, onto the place behind. */
async function stepBack(
  s: ProductHarness,
  actorId: string,
  from: PuzzlePlaceSeen
): Promise<PuzzlePlaceSeen> {
  const ui = await actorUi(s, actorId);
  await ui.get(Handles.navBack).tap({ timeoutMs: WAIT_MS });
  return waitPlace(
    s,
    actorId,
    (seen) => seen.place !== from.place || seen.stage !== from.stage,
    `back from ${from.place}`
  );
}

/**
 * Back to the home of the stage the puzzles are in (the board, the result
 * or why there is no puzzle), from whichever place is open: at most two
 * steps. Nothing to do on the home, or off the puzzles.
 */
export async function showPuzzleHome(
  s: ProductHarness,
  actorId: string
): Promise<PuzzlePlaceSeen | null> {
  let seen = await readPuzzlePlace(s, actorId);
  for (let steps = 0; steps < 3; steps += 1) {
    if (seen === null || isHomePlace(seen.place)) return seen;
    seen = await stepBack(s, actorId, seen);
  }
  return seen;
}

/**
 * The line's own place, where it is stepped through: from the board by
 * "Look back", from a result by its row to the line.
 */
export async function openPuzzleLine(
  s: ProductHarness,
  actorId: string
): Promise<void> {
  const here = await readPuzzlePlace(s, actorId);
  if (here?.place === 'line') return;
  const home = await showPuzzleHome(s, actorId);
  const ui = await actorUi(s, actorId);
  const way =
    home?.place === 'result' ? Handles.chessPuzzleSummaryClose : LINE_OPEN;
  await ui.get(way).tap({ timeoutMs: WAIT_MS });
  await waitPlace(s, actorId, (seen) => seen.place === 'line', 'the line');
}

/**
 * The feed settings: from a stage's home by its settings row, or from one
 * of the settings by Back. The draft being edited is kept either way.
 */
export async function openPuzzleFeed(
  s: ProductHarness,
  actorId: string
): Promise<void> {
  let here = await readPuzzlePlace(s, actorId);
  if (here?.place === 'feed') return;
  if (here !== null && isFeedPlace(here.place)) {
    await stepBack(s, actorId, here);
    return;
  }
  here = await showPuzzleHome(s, actorId);
  const ui = await actorUi(s, actorId);
  await ui.get(Handles.chessPuzzleFeedSummary).tap({ timeoutMs: WAIT_MS });
  await waitPlace(s, actorId, (seen) => seen.place === 'feed', 'the settings');
}

/** Whether the feed settings, or one of their settings, are on show. */
export async function isPuzzleFeedOpen(
  s: ProductHarness,
  actorId: string
): Promise<boolean> {
  const here = await readPuzzlePlace(s, actorId);
  return here !== null && isFeedPlace(here.place);
}

/**
 * One setting's own place, through its row in the feed settings (opened
 * first when they are not). Already there: nothing to do.
 */
export async function openFeedSetting(
  s: ProductHarness,
  actorId: string,
  setting: FeedSettingPlace
): Promise<void> {
  const here = await readPuzzlePlace(s, actorId);
  if (here?.place === setting) return;
  await openPuzzleFeed(s, actorId);
  const ui = await actorUi(s, actorId);
  await ui.get(FEED_SETTING_ROW[setting]).tap({ timeoutMs: WAIT_MS });
  await waitPlace(s, actorId, (seen) => seen.place === setting, setting);
}

/** Until the feed settings themselves show again (a choice returns there). */
export async function waitPuzzleFeedHub(
  s: ProductHarness,
  actorId: string
): Promise<void> {
  await waitPlace(s, actorId, (seen) => seen.place === 'feed', 'the settings');
}

/** Until the feed settings and all their settings are left. */
export async function waitPuzzleFeedClosed(
  s: ProductHarness,
  actorId: string
): Promise<void> {
  await pollUntil(
    s,
    async () => ((await isPuzzleFeedOpen(s, actorId)) ? null : true),
    { maxMs: WAIT_MS, stepMs: POLL_MS, description: 'the settings closed' }
  );
}

/**
 * Leave the feed settings without saving, as Back from them does: the
 * draft is dropped and the feed stays as it was.
 */
export async function leavePuzzleFeedUnsaved(
  s: ProductHarness,
  actorId: string
): Promise<void> {
  if (!(await isPuzzleFeedOpen(s, actorId))) return;
  await openPuzzleFeed(s, actorId);
  const ui = await actorUi(s, actorId);
  await ui.get(Handles.navBack).tap({ timeoutMs: WAIT_MS });
  await waitPuzzleFeedClosed(s, actorId);
}
