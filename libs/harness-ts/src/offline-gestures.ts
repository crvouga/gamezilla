import { Handles } from '@libs/test-ids-shared-ts/handles';
import { actorUi } from './actor-ui';
import type { ProductHarness } from './harness';

const WAIT_MS = 15_000;

export async function chooseOfflineCommand(
  s: ProductHarness,
  actorId: string,
  offline: boolean
): Promise<void> {
  const ui = await actorUi(s, actorId);
  if ((await ui.get(Handles.statusWorkOffline).isVisible()) === offline) return;
  const account = ui.get(Handles.statusCurrentUser);
  await account.expect.visible({ timeoutMs: WAIT_MS });
  // A parked client's focused element must not receive this client's shortcut.
  await account.key('commandPalette');
  const input = ui.get(Handles.commandPaletteInput);
  await input.expect.visible({ timeoutMs: WAIT_MS });
  await input.clear();
  await input.input(offline ? 'Work offline' : 'Work online');
  await input.key('enter');
  await s.session.waitForIdle();
}
