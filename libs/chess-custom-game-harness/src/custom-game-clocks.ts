import type { CustomGameSide } from '@libs/chess-custom-game-shared/custom-game-state';
import { actorUi } from '@libs/harness/actor-ui';
import type { ProductHarness } from '@libs/harness/harness';
import { bringToFront } from '@libs/harness/observations';

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
    .get(`chess-custom-${side}-clock`)
    .text();
  const parts = /^(\d+):(\d{2})$/.exec(text ?? '');
  if (parts === null)
    throw new Error(`${actor} sees no ${side} clock: ${text}`);
  return Number(parts[1]) * 60 + Number(parts[2]);
}
