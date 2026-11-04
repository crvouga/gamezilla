import type { ProductHarness } from '@libs/harness-ts/harness';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import { offeredInSpaceMenu } from './space-menu-ui-reads';

/** The host is offered to end the space they are looking at (in its ⋯ menu). */
export function endOffered(
  s: ProductHarness,
  actorId: string
): Promise<boolean> {
  return offeredInSpaceMenu(s, actorId, Handles.spaceEnd);
}
