/**
 * Puzzle feed settings drivers: open the modal from the feed bar, flip
 * history / mode segments, step the rating offset, and read the bar labels.
 */

import { Handles } from '@libs/test-ids';

import { actorUi, pollUntil } from './actor-ui';
import type { ProductSim } from './sim';

const WAIT_MS = 15_000;
const POLL_MS = 250;

export type FeedHistoryFilter = 'any' | 'neverSeen' | 'seen' | 'failed';
export type FeedMode = 'auto' | 'custom';

function stripProbe(text: string | null | undefined): string {
  return (text ?? '').replace(/\u200b/g, '').trim();
}

export async function openFeedSettings(
  s: ProductSim,
  actorId: string
): Promise<void> {
  const ui = await actorUi(s, actorId);
  await ui.get(Handles.chessPuzzleFeedSummary).tap({ timeoutMs: WAIT_MS });
  await ui.get(Handles.chessPuzzleFeedDone).expect.visible({
    timeoutMs: WAIT_MS,
  });
}

export async function closeFeedSettings(
  s: ProductSim,
  actorId: string
): Promise<void> {
  const ui = await actorUi(s, actorId);
  await ui.get(Handles.chessPuzzleFeedDone).tap({ timeoutMs: WAIT_MS });
  await ui.get(Handles.chessPuzzleFeedDone).expect.hidden({
    timeoutMs: WAIT_MS,
  });
}

export async function selectFeedHistory(
  s: ProductSim,
  actorId: string,
  filter: FeedHistoryFilter
): Promise<void> {
  const ui = await actorUi(s, actorId);
  await ui
    .get(Handles.chessPuzzleFeedHistorySegment(filter))
    .tap({ timeoutMs: WAIT_MS });
}

export async function selectFeedMode(
  s: ProductSim,
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
  s: ProductSim,
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

export async function increaseFeedCustomRating(
  s: ProductSim,
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
  s: ProductSim,
  actorId: string
): Promise<number | null> {
  const ui = await actorUi(s, actorId);
  const raw = stripProbe(
    await ui.get(Handles.chessPuzzleFeedOffsetValue).text()
  );
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : null;
}

/** "Target rating: 1300" caption inside the modal → 1300. */
export async function readFeedModalTargetRating(
  s: ProductSim,
  actorId: string
): Promise<number | null> {
  const ui = await actorUi(s, actorId);
  const raw = stripProbe(await ui.get(Handles.chessPuzzleFeedTarget).text());
  const match = /(\d{3,4})\s*$/.exec(raw);
  return match?.[1] !== undefined ? Number.parseInt(match[1], 10) : null;
}

/** "N matching · M local puzzles" → { matched, total }. */
export async function readFeedModalPool(
  s: ProductSim,
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
  s: ProductSim,
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
  s: ProductSim,
  actorId: string
): Promise<string | null> {
  const ui = await actorUi(s, actorId);
  const raw = stripProbe(
    await ui.get(Handles.chessPuzzleFeedHistoryLabel).text()
  );
  return raw.length > 0 ? raw : null;
}

export async function waitFeedTargetRating(
  s: ProductSim,
  actorId: string,
  rating: number
): Promise<void> {
  await pollUntil(
    s,
    async () => {
      const label = await readFeedTargetLabel(s, actorId);
      return label !== null && label.rating === rating ? true : null;
    },
    {
      maxMs: WAIT_MS,
      stepMs: POLL_MS,
      description: `feed target rating ${String(rating)}`,
    }
  );
}
