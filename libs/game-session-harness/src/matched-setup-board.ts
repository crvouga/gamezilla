/**
 * Whether a person's matched game shows them their setup board: only while
 * they are still choosing their private setup in a game waiting for both.
 */

import { actorUi } from '@libs/harness/actor-ui';
import type { ProductHarness } from '@libs/harness/harness';
import { bringToFront } from '@libs/harness/observations';
import { MATCHED_GAME_SETUP_BOARD } from './matched-game-private-setup';

export async function matchedSetupBoardShown(
  s: ProductHarness,
  actor: string
): Promise<boolean> {
  await bringToFront(s, actor);
  return (await actorUi(s, actor)).get(MATCHED_GAME_SETUP_BOARD).isVisible();
}
