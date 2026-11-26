import type { ProductHarness } from '@libs/harness-ts/harness';
import { visible } from '@libs/harness-ts/observations';
import { Handles } from '@libs/test-ids-shared-ts/handles';

/** The host is offered to end the space they are looking at (in its top row). */
export function endOffered(
  s: ProductHarness,
  actorId: string
): Promise<boolean> {
  return visible(s, actorId, [Handles.spaceEnd]);
}
