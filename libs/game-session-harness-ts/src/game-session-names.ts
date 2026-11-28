import type { GameSessionSide } from '@libs/game-session-shared-ts/game-session-state';
import { actorUi } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { bringToFront } from '@libs/harness-ts/observations';

export async function readGameSessionName(
  s: ProductHarness,
  actor: string,
  side: GameSessionSide
): Promise<string | null> {
  const ui = await actorUi(s, actor);
  await bringToFront(s, actor);
  return ui.get(`game-session-${side}-person`).text();
}
