/**
 * A saved preference survives an unfinished choice and a stretch of trouble.
 * Stimuli are what a person does; reads are what the app shows afterwards.
 */

import { actorUi, scenarioAction } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { HARNESS_PRIMARY_SERVER_ID } from '@libs/harness-ts/server-nodes';
import { openSettings, openTab } from '@libs/harness-ts/shell-actions';
import { Handles } from '@libs/test-ids-shared-ts/handles';

const WAIT_MS = 15_000;
const TROUBLE_MS = 1_000;

/** Settings → Sound, without changing the saved preference. */
export const openSoundSettings = scenarioAction({
  name: 'openSoundSettings',
  act: async (s, actorId: string) => {
    const ui = await actorUi(s, actorId);
    if (await ui.get(Handles.soundEffectsSwitch).isVisible()) return;
    await Promise.resolve(openSettings.act(s, actorId));
    await ui.get(Handles.settingsSound).tap({ timeoutMs: WAIT_MS });
    await ui
      .get(Handles.soundEffectsSwitch)
      .expect.visible({ timeoutMs: WAIT_MS });
    await s.session.waitForIdle();
  },
});

/** The app's machines fail and come back. The person is not moved. */
export const runIntoTrouble = scenarioAction({
  name: 'runIntoTrouble',
  act: async (s, actorId: string) => {
    await actorUi(s, actorId);
    s.harness.crash(HARNESS_PRIMARY_SERVER_ID);
    await s.session.advanceTime(TROUBLE_MS);
    s.harness.restart(HARNESS_PRIMARY_SERVER_ID);
    await s.session.waitForIdle();
  },
});

/** From the tabs, open Profile. */
export const leaveForProfile = scenarioAction({
  name: 'leaveForProfile',
  act: async (s, actorId: string) => {
    await Promise.resolve(openTab.act(s, actorId, Handles.tabProfile));
  },
});

/** "spaces", "settings", or "profile", from the place the app is showing. */
export async function preferencePlace(
  s: ProductHarness,
  actorId: string
): Promise<string> {
  const handle = s.actors.get(actorId);
  if (handle === undefined) return 'spaces';
  const path = await handle.currentPath();
  if (path.includes('profile')) return 'profile';
  if (path.includes('/more')) return 'settings';
  return 'spaces';
}
