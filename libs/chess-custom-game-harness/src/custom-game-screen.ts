import { waitCustomGameAvailability } from '@libs/game-session-harness/game-navigation';
import { actorUi } from '@libs/harness/actor-ui';
import type { ProductHarness } from '@libs/harness/harness';
import { bringToFront } from '@libs/harness/observations';
import { Handles } from '@libs/test-ids-shared/handles';

export async function openCustomGameScreen(
  s: ProductHarness,
  actor: string
): Promise<void> {
  const ui = await actorUi(s, actor);
  await bringToFront(s, actor);
  await waitCustomGameAvailability(s, actor, 'chess');
  if (await ui.get(Handles.gameMenu('chess')).isVisible())
    await ui.get(Handles.gameMenu('chess')).tap();
  if (await ui.get('game-choice-custom-game').isVisible())
    await ui.get('game-choice-custom-game').tap();
  await ui.get('custom-game-status').expect.visible();
}
