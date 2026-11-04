import { actorUi } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { Handles } from '@libs/test-ids-shared-ts/handles';

const MENU_WAIT_MS = 5_000;

/**
 * The host is offered to end the space they are looking at. End lives in
 * the space's ⋯ menu, set apart from everyday controls, so look there the
 * way a person does: open ⋯, see whether End is in it, and close it again.
 */
export async function endOffered(
  s: ProductHarness,
  actorId: string
): Promise<boolean> {
  const ui = await actorUi(s, actorId);
  const end = ui.get(Handles.spaceEnd);
  if (await end.isVisible()) return true;
  const menu = ui.get(Handles.spaceChromeOverflow);
  if (!(await menu.isVisible())) return false;
  await menu.tap({ timeoutMs: MENU_WAIT_MS });
  // Every ⋯ menu ends in a way out: Leave for everyone, End for the host.
  await ui.get(Handles.spaceLeave).expect.visible({ timeoutMs: MENU_WAIT_MS });
  const offered = await end.isVisible();
  await ui.key('escape');
  await ui.get(Handles.spaceLeave).expect.hidden({ timeoutMs: MENU_WAIT_MS });
  return offered;
}
