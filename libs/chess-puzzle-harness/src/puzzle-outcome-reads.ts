/**
 * What a solver sees once an attempt's outcome is decided: the rating change
 * (or that the attempt is unrated), the puzzle's own rating and its themes.
 */

import { actorUi } from '@libs/harness/actor-ui';
import type { ProductHarness } from '@libs/harness/harness';
import { Handles } from '@libs/test-ids-shared/handles';

export type ShownRatingChange = 'raised' | 'lowered' | 'unchanged' | 'unrated';

function stripProbe(text: string | null | undefined): string {
  return (text ?? '').replace(/​/g, '').trim();
}

/** The rating change on screen, read off its signed number; null if none. */
export async function readShownRatingChange(
  s: ProductHarness,
  actorId: string
): Promise<ShownRatingChange | null> {
  const ui = await actorUi(s, actorId);
  for (const handle of [
    Handles.chessPuzzleSummaryDelta,
    Handles.chessPuzzleFeedRatingChange,
  ]) {
    const node = ui.get(handle);
    if (!(await node.isVisible())) continue;
    const text = stripProbe(await node.text());
    const match = /^([+\-−])?(\d+)$/.exec(text);
    if (match === null) return text.length > 0 ? 'unrated' : null;
    if (match[2] === '0') return 'unchanged';
    return match[1] === '+' ? 'raised' : 'lowered';
  }
  const unrated = ui.get(Handles.chessPuzzleFeedUnratedLabel);
  return (await unrated.isVisible()) ? 'unrated' : null;
}

/** The puzzle's own rating shows: on the feed bar or the result panel. */
export async function isPuzzleOwnRatingVisible(
  s: ProductHarness,
  actorId: string
): Promise<boolean> {
  const ui = await actorUi(s, actorId);
  for (const handle of [
    Handles.chessPuzzleBoardElo,
    Handles.chessPuzzleSummaryPuzzleRating,
  ]) {
    const node = ui.get(handle);
    if ((await node.isVisible()) && /\d/.test(stripProbe(await node.text()))) {
      return true;
    }
  }
  return false;
}

/** The puzzle's themes show on the feed bar. */
export async function isPuzzleThemesVisible(
  s: ProductHarness,
  actorId: string
): Promise<boolean> {
  const ui = await actorUi(s, actorId);
  const node = ui.get(Handles.chessPuzzleFeedPuzzleThemes);
  return (await node.isVisible()) && stripProbe(await node.text()).length > 0;
}
