/**
 * The space's game choice as a person meets it: one tile per family, and a
 * family of several modes (Light Cycles Duel, Trio, Quad) opening them
 * before one is picked. Bindings that name a game by id reach it here.
 */

import type { actorUi } from '@libs/harness-ts/actor-ui';
import { Handles } from '@libs/test-ids-shared-ts/handles';

type Ui = Awaited<ReturnType<typeof actorUi>>;
type TapOptions = { readonly timeoutMs?: number };

/**
 * The controls of the game choice that lead to `gameId`: its own tile or
 * mode row, then each family tile it may sit under.
 */
export function gameChoiceHandles(gameId: string): readonly string[] {
  return [Handles.gameMenu(gameId), ...Handles.gameFamiliesOf(gameId)];
}

/** Whether the game choice shows the way to `gameId`. */
export async function gameChoiceShown(
  ui: Ui,
  gameId: string
): Promise<boolean> {
  for (const handle of gameChoiceHandles(gameId))
    if (await ui.get(handle).isVisible()) return true;
  return false;
}

/**
 * Pick `gameId` on the game choice once it shows: its tile, or its family's
 * tile and then its row among the family's modes. A guest's tiles do
 * nothing, and a guest is already told the host is choosing, so the
 * attempt ends there.
 */
export async function tapGameChoice(
  ui: Ui,
  gameId: string,
  options: TapOptions = {}
): Promise<void> {
  const own = ui.get(Handles.gameMenu(gameId));
  await own.wait('visible', {
    ...options,
    description: `the game choice offering ${gameId}`,
    visibleOr: Handles.gameFamiliesOf(gameId),
  });
  if (await own.isVisible()) {
    await own.tap(options);
    return;
  }
  for (const handle of Handles.gameFamiliesOf(gameId)) {
    const family = ui.get(handle);
    if (!(await family.isVisible())) continue;
    await family.tap(options);
    await own.wait('visible', {
      ...options,
      visibleOr: [Handles.spaceHostChoosesGame],
    });
    if (await own.isVisible()) await own.tap(options);
    return;
  }
}
