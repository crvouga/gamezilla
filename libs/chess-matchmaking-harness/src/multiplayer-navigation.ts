import { actorUi, pollUntil } from '@libs/harness/actor-ui';
import type { ProductHarness } from '@libs/harness/harness';
import { Handles } from '@libs/test-ids-shared/handles';

/** Return from another chess activity through the space's own Back control. */
export async function reachMultiplayerChoices(
  s: ProductHarness,
  actor: string
) {
  const ui = await actorUi(s, actor);
  for (let depth = 0; depth < 8; depth++) {
    const target = await pollUntil(
      s,
      async () => {
        for (const id of [
          'game-menu-chess',
          'chess-menu-multiplayer',
          'multiplayer-game',
          'multiplayer-waiting',
          'multiplayer-find',
          'multiplayer-access-denial',
          'multiplayer-unavailable',
          Handles.navBack,
        ])
          if (await ui.get(id).isVisible()) return id;
        return null;
      },
      { maxMs: 5000, description: 'the space chess choices' }
    );
    if (target !== Handles.navBack) return target;
    await ui.get(Handles.navBack).tap();
  }
  throw new Error('The space never returned to its chess choices');
}
