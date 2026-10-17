import { actorUi, pollUntil } from '@libs/harness/actor-ui';
import type { ProductHarness } from '@libs/harness/harness';
import { bringToFront } from '@libs/harness/observations';
import { Handles } from '@libs/test-ids-shared/handles';

export async function openCustomGameScreen(
  s: ProductHarness,
  actor: string
): Promise<void> {
  const ui = await actorUi(s, actor);
  await bringToFront(s, actor);
  await waitCustomGameAvailability(s, actor);
  if (await ui.get(Handles.gameMenu('chess')).isVisible())
    await ui.get(Handles.gameMenu('chess')).tap();
  if (await ui.get('game-choice-custom-game').isVisible())
    await ui.get('game-choice-custom-game').tap();
  await ui.get('custom-game-status').expect.visible();
}

/** Wait for actual play choices, or the host's unavailable notice. */
export async function waitCustomGameAvailability(
  s: ProductHarness,
  actor: string
): Promise<'available' | 'host offline'> {
  const ui = await actorUi(s, actor);
  return pollUntil(
    s,
    async () => {
      if (await ui.get(Handles.spaceHostOffline).isVisible())
        return 'host offline';
      for (const handle of [
        Handles.gameMenu('chess'),
        'game-choice-custom-game',
        'custom-game-status',
      ]) {
        if (await ui.get(handle).isVisible()) return 'available';
      }
      return null;
    },
    {
      maxMs: 15_000,
      stepMs: 1,
      description: 'space play choices or host availability',
    }
  );
}
