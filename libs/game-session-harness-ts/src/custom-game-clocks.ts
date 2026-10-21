import type { CustomGameSide } from '@libs/game-session-shared-ts/custom-game-state';
import { actorUi } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { bringToFront } from '@libs/harness-ts/observations';

export function readCustomGameTime(s: ProductHarness): number {
  return s.harness.clock.now();
}

/** The clock a person sees, read from the rendered clock rather than recalculated. */
export async function readCustomGameSeconds(
  s: ProductHarness,
  actor: string,
  side: CustomGameSide
): Promise<number> {
  await bringToFront(s, actor);
  const text = await (await actorUi(s, actor))
    .get(`custom-game-${side}-clock`)
    .text();
  const parts = /^(\d+):(\d{2})$/.exec(text ?? '');
  if (parts === null)
    throw new Error(`${actor} sees no ${side} clock: ${text}`);
  return Number(parts[1]) * 60 + Number(parts[2]);
}
