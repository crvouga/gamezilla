import type { CustomGameSide } from '@libs/game-session-shared-ts/custom-game-state';
import { actorUi } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { bringToFront } from '@libs/harness-ts/observations';

/**
 * What the seat of `side` calls whoever holds it, on the person's screen:
 * while the game is set up its seat names them; once it is played their
 * cell in the space's people row does, its accessible name opening with
 * the name (`You` for the person themselves).
 */
export async function readCustomGameName(
  s: ProductHarness,
  actor: string,
  side: CustomGameSide
): Promise<string | null> {
  const ui = await actorUi(s, actor);
  await bringToFront(s, actor);
  const seat = ui.get(`custom-game-${side}-person`);
  if (!(await seat.isVisible())) return seat.text();
  const label = await seat.attribute('aria-label');
  return label === null ? seat.text() : (label.split(', ')[0] ?? null);
}
