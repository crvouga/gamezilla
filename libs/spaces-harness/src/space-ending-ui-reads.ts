import { actorUi } from '@libs/harness/actor-ui';
import type { ProductHarness } from '@libs/harness/harness';
import { Handles } from '@libs/test-ids-shared/handles';

/** The host is offered to end the space they are looking at. */
export async function endOffered(
  s: ProductHarness,
  actorId: string
): Promise<boolean> {
  const ui = await actorUi(s, actorId);
  return ui.get(Handles.spaceEnd).isVisible();
}
