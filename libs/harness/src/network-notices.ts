import type { ProductHarness } from '@libs/harness/harness';
import { visible } from '@libs/harness/observations';
import { Handles } from '@libs/test-ids-shared/handles';

/** The persistent notice beside the app, independent of the current route. */
export function connectionMissing(
  s: ProductHarness,
  actorId: string
): Promise<boolean> {
  return visible(s, actorId, [Handles.statusConnectionMissing]);
}
