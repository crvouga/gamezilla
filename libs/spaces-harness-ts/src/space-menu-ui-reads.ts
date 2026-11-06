import { actorUi } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { Handles } from '@libs/test-ids-shared-ts/handles';

const MENU_WAIT_MS = 5_000;

/**
 * The space offers `handle` (Leave, End), on its screen or in its ⋯ menu,
 * where the ways out of a space sit apart from everyday controls. Look the
 * way a person does: open ⋯, see whether it is there, and close it again.
 */
export async function offeredInSpaceMenu(
  s: ProductHarness,
  actorId: string,
  handle: string
): Promise<boolean> {
  const ui = await actorUi(s, actorId);
  const target = ui.get(handle);
  if (await target.isVisible()) return true;
  const menu = ui.get(Handles.spaceChromeOverflow);
  if (!(await menu.isVisible())) return false;
  await menu.tap({ timeoutMs: MENU_WAIT_MS });
  // Share is in every space's ⋯ menu: the menu is open once it shows.
  const share = ui.get(Handles.spaceShare);
  await share.expect.visible({ timeoutMs: MENU_WAIT_MS });
  const offered = await target.isVisible();
  await ui.key('escape');
  await share.expect.hidden({ timeoutMs: MENU_WAIT_MS });
  return offered;
}
