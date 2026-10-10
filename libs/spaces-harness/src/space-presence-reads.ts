import { actorUi } from '@libs/harness/actor-ui';
import type { ProductHarness } from '@libs/harness/harness';
import { Handles } from '@libs/test-ids-shared/handles';

/** Whether the person is currently looking at the space's presence. */
export async function presenceShown(
  s: ProductHarness,
  actor: string
): Promise<boolean> {
  const ui = await actorUi(s, actor);
  return await ui.get(Handles.spaceMembersClose).isVisible();
}
