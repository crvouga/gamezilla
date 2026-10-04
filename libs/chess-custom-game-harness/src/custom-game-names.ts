import { actorUi } from '@libs/harness/actor-ui';
import type { ProductHarness } from '@libs/harness/harness';
import { bringToFront } from '@libs/harness/observations';
import type { CustomGameSide } from '@libs/chess-custom-game-shared/custom-game-state';

export async function readCustomGameName(
  s: ProductHarness,
  actor: string,
  side: CustomGameSide
): Promise<string | null> {
  const ui = await actorUi(s, actor);
  await bringToFront(s, actor);
  return ui.get(`chess-custom-${side}-person`).text();
}
