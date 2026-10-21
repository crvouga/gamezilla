/**
 * A finished game's replay in the game's history: opening a record from the
 * list, and the position its board shows.
 */

import { actorUi, scenarioAction } from '@libs/harness/actor-ui';
import type { ProductHarness } from '@libs/harness/harness';
import { bringToFront } from '@libs/harness/observations';

const SHOWN = 'game-history-review-move';

/** `actor` opens the most recent finished game listed in the history in front of them. */
export const openGameHistoryRecord = scenarioAction({
  name: 'openGameHistoryRecord',
  act: async (s, actor: string) => {
    const ui = await actorUi(s, actor);
    await bringToFront(s, actor);
    if (await ui.get(SHOWN).isVisible()) return;
    await ui.get('game-history-record').tap();
    await s.session.waitForIdle();
  },
});

/** The position the history's replay board shows `actor`, `null` without one. */
export async function gameHistoryReviewPosition(
  s: ProductHarness,
  actor: string
): Promise<string | null> {
  const ui = await actorUi(s, actor);
  await bringToFront(s, actor);
  const shown = ui.get(SHOWN);
  return (await shown.isVisible())
    ? await shown.attribute('data-shown-position')
    : null;
}
