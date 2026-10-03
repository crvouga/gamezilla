import { actorUi } from '@libs/harness/system/actor-ui';
import type { ProductHarness } from '@libs/harness/system/harness';
import { bringToFront } from '@libs/harness/system/observations';
import type { CustomGameSide } from '../public/custom-game';

export async function readCustomGameName(
  s: ProductHarness,
  actor: string,
  side: CustomGameSide
): Promise<string | null> {
  const ui = await actorUi(s, actor);
  await bringToFront(s, actor);
  return ui.get(`chess-custom-${side}-person`).text();
}
