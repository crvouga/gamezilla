import { actorUi } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import { SPACE_WAIT_MS, tapSpaceAction } from './space-ui';

/** The saved name exposed in the host's rename dialog, without saving. */
export async function readSavedSpaceName(
  s: ProductHarness,
  actorId: string
): Promise<string | null> {
  await tapSpaceAction(s, actorId, Handles.spaceRename);
  const ui = await actorUi(s, actorId);
  const input = ui.get(Handles.spaceRenameInput);
  await input.expect.visible({ timeoutMs: SPACE_WAIT_MS });
  const name = await input.text();
  const cancel = ui.get(Handles.spaceRenameCancel);
  await cancel.tap({ timeoutMs: SPACE_WAIT_MS });
  await cancel.expect.hidden({ timeoutMs: SPACE_WAIT_MS });
  await ui.get(Handles.spaceMembersClose).tap({ timeoutMs: SPACE_WAIT_MS });
  return name;
}
