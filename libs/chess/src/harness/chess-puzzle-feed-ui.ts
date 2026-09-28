/**
 * Puzzle feed settings drivers: open the modal from the feed bar, flip
 * history / mode segments, step the rating offset, and read the bar labels.
 */

import { actorUi, pollUntil } from '@libs/harness/system/actor-ui';
import type { ProductHarness } from '@libs/harness/system/harness';
import { Handles } from '@libs/test-ids';
import { formatChessPuzzleThemeLabel } from '../public/chess-puzzle-theme-label';
import type { ChessPuzzleTheme } from '../public/chess-puzzle-themes';

const WAIT_MS = 15_000;
const POLL_MS = 250;

export type FeedHistoryFilter = 'any' | 'neverSeen' | 'seen' | 'failed';
export type FeedMode = 'auto' | 'custom';

function stripProbe(text: string | null | undefined): string {
  return (text ?? '').replace(/\u200b/g, '').trim();
}

export async function openFeedSettings(
  s: ProductHarness,
  actorId: string
): Promise<void> {
  const ui = await actorUi(s, actorId);
  await ui.get(Handles.chessPuzzleFeedSummary).tap({ timeoutMs: WAIT_MS });
  await ui.get(Handles.chessPuzzleFeedDone).expect.visible({
    timeoutMs: WAIT_MS,
  });
}

export async function closeFeedSettings(
  s: ProductHarness,
  actorId: string
): Promise<void> {
  const ui = await actorUi(s, actorId);
  await ui.get(Handles.chessPuzzleFeedDone).tap({ timeoutMs: WAIT_MS });
  await ui.get(Handles.chessPuzzleFeedDone).expect.hidden({
    timeoutMs: WAIT_MS,
  });
}

export async function selectFeedHistory(
  s: ProductHarness,
  actorId: string,
  filter: FeedHistoryFilter
): Promise<void> {
  const ui = await actorUi(s, actorId);
  await ui
    .get(Handles.chessPuzzleFeedHistorySegment(filter))
    .tap({ timeoutMs: WAIT_MS });
}

export async function selectFeedMode(
  s: ProductHarness,
  actorId: string,
  mode: FeedMode
): Promise<void> {
  const ui = await actorUi(s, actorId);
  await ui
    .get(Handles.chessPuzzleFeedModeSegment(mode))
    .tap({ timeoutMs: WAIT_MS });
}

/** Tap the offset "+" `steps` times (each step is one offset increment). */
export async function increaseFeedOffset(
  s: ProductHarness,
  actorId: string,
  steps: number
): Promise<void> {
  const ui = await actorUi(s, actorId);
  for (let i = 0; i < steps; i += 1) {
    await ui
      .get(Handles.chessPuzzleFeedOffsetIncrease)
      .tap({ timeoutMs: WAIT_MS });
  }
}
export type FeedAutoAdvance = 'off' | 'after1s' | 'immediate';

/** §5 auto-advance segment in the feed settings modal. */
export async function selectFeedAutoAdvance(
  s: ProductHarness,
  actorId: string,
  setting: FeedAutoAdvance
): Promise<void> {
  const ui = await actorUi(s, actorId);
  await ui
    .get(Handles.chessPuzzleFeedAutoAdvanceSegment(setting))
    .tap({ timeoutMs: WAIT_MS });
}

/**
 * Toggle one theme in the (virtualized, searchable) themes combobox: search
 * by label so the row is rendered, tap it, then close the picker.
 */
export async function selectFeedTheme(
  s: ProductHarness,
  actorId: string,
  theme: ChessPuzzleTheme
): Promise<void> {
  const ui = await actorUi(s, actorId);
  await ui.get(Handles.chessPuzzleFeedThemeTrigger).tap({ timeoutMs: WAIT_MS });
  await ui
    .get(Handles.chessPuzzleFeedThemeSearch)
    .input(formatChessPuzzleThemeLabel(theme));
  await ui
    .get(Handles.chessPuzzleFeedThemeOption(theme))
    .tap({ timeoutMs: WAIT_MS });
  await ui.get(Handles.chessPuzzleFeedThemeDone).tap({ timeoutMs: WAIT_MS });
  await ui.get(Handles.chessPuzzleFeedThemeDone).expect.hidden({
    timeoutMs: WAIT_MS,
  });
}

/** Tap the custom target rating '+' `steps` times. */

export async function increaseFeedCustomRating(
  s: ProductHarness,
  actorId: string,
  steps: number
): Promise<void> {
  const ui = await actorUi(s, actorId);
  for (let i = 0; i < steps; i += 1) {
    await ui
      .get(Handles.chessPuzzleFeedCustomRatingIncrease)
      .tap({ timeoutMs: WAIT_MS });
  }
}

export async function readFeedOffsetValue(
  s: ProductHarness,
  actorId: string
): Promise<number | null> {
  const ui = await actorUi(s, actorId);
  const raw = stripProbe(
    await ui.get(Handles.chessPuzzleFeedOffsetValue).text()
  );
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : null;
}

/**
 * The target the modal shows: the custom rating stepper's value in custom
 * mode, else the "Target rating: 1300" caption under the offset → 1300.
 */
export async function readFeedModalTargetRating(
  s: ProductHarness,
  actorId: string
): Promise<number | null> {
  const ui = await actorUi(s, actorId);
  const custom = ui.get(Handles.chessPuzzleFeedCustomRatingValue);
  const raw = stripProbe(
    await ((await custom.isVisible())
      ? custom.text()
      : ui.get(Handles.chessPuzzleFeedTarget).text())
  );
  const match = /(\d{3,4})\s*$/.exec(raw);
  return match?.[1] !== undefined ? Number.parseInt(match[1], 10) : null;
}

/** "N matching · M local puzzles" → { matched, total }. */
export async function readFeedModalPool(
  s: ProductHarness,
  actorId: string
): Promise<{ matched: number; total: number } | null> {
  const ui = await actorUi(s, actorId);
  const raw = stripProbe(await ui.get(Handles.chessPuzzleFeedPool).text());
  const nums = raw.match(/\d+/g);
  const [matched, total] = nums ?? [];
  if (matched === undefined || total === undefined) return null;
  return {
    matched: Number.parseInt(matched, 10),
    total: Number.parseInt(total, 10),
  };
}

/** Feed bar "Auto · 1200" / "Custom · 1500" → { mode, rating }. */
export async function readFeedTargetLabel(
  s: ProductHarness,
  actorId: string
): Promise<{ mode: FeedMode; rating: number } | null> {
  const ui = await actorUi(s, actorId);
  const raw = stripProbe(
    await ui.get(Handles.chessPuzzleFeedTargetLabel).text()
  );
  const match = /^(Auto|Custom)\s*·\s*(\d{3,4})$/.exec(raw);
  const rating = match?.[2];
  if (match === null || rating === undefined) return null;
  return {
    mode: match[1] === 'Auto' ? 'auto' : 'custom',
    rating: Number.parseInt(rating, 10),
  };
}

export async function readFeedHistoryLabel(
  s: ProductHarness,
  actorId: string
): Promise<string | null> {
  const ui = await actorUi(s, actorId);
  const raw = stripProbe(
    await ui.get(Handles.chessPuzzleFeedHistoryLabel).text()
  );
  return raw.length > 0 ? raw : null;
}

export async function waitFeedTargetRating(
  s: ProductHarness,
  actorId: string,
  rating: number
): Promise<void> {
  await pollUntil(
    s,
    async () => {
      const label = await readFeedTargetLabel(s, actorId);
      return label?.rating === rating ? true : null;
    },
    {
      maxMs: WAIT_MS,
      stepMs: POLL_MS,
      description: `feed target rating ${String(rating)}`,
    }
  );
}

/**
 * The feed settings invite the person to sign in instead of offering the
 * feed choices (a guest cannot customize the feed): the invitation shows,
 * its call to action reads "Sign in", and no choice is on offer.
 */
export async function isFeedSignInInviteVisible(
  s: ProductHarness,
  actorId: string
): Promise<boolean> {
  const ui = await actorUi(s, actorId);
  if (!(await ui.get(Handles.chessPuzzleFeedLocked).isVisible())) return false;
  if (await ui.get(Handles.chessPuzzleFeedPool).isVisible()) return false;
  const action = ui.get(`${Handles.chessPuzzleFeedLocked}-action`);
  if (!(await action.isVisible())) return false;
  return (await action.text())?.trim() === 'Sign in';
}
