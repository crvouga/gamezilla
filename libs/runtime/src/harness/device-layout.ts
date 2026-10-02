import {
  actorUi,
  ensureActor,
  scenarioAction,
} from '@libs/harness/system/actor-ui';
import type { ProductHarness } from '@libs/harness/system/harness';
import { openSettings } from '@libs/harness/system/shell-actions';
import { Handles } from '@libs/test-ids';
import {
  appearanceShown,
  chooseTheme,
  soundShownInSettings,
  turnSoundsOff,
} from './app-settings';

export const changeAvailableSpace = scenarioAction({
  name: 'changeAvailableSpace',
  act: async (s, actor: string, width: number, height: number) => {
    await ensureActor(s, actor);
    const device = s.actors.get(actor);
    if (device === undefined) throw new Error('Device missing');
    await device.setViewport({ width, height });
    await s.session.waitForIdle();
  },
});
export const saveLayoutPreferences = scenarioAction({
  name: 'saveLayoutPreferences',
  act: async (s, actor: string) => {
    await Promise.resolve(chooseTheme.act(s, actor, 'dark'));
    await Promise.resolve(turnSoundsOff.act(s, actor));
    await Promise.resolve(openSettings.act(s, actor));
  },
});
export async function layoutPlaceAndPreferences(
  s: ProductHarness,
  actor: string
) {
  const device = s.actors.get(actor);
  if (device === undefined) throw new Error('Device missing');
  return {
    place: await device.currentPath(),
    appearance: await appearanceShown(s, actor),
    sounds: await soundShownInSettings(s, actor),
  };
}
/** Offered Settings controls can be addressed and operated at every viewport. */
export async function layoutControlsReachable(
  s: ProductHarness,
  actor: string
) {
  const ui = await actorUi(s, actor);
  const controls = [
    Handles.settingsTheme,
    Handles.settingsSound,
    Handles.settingsAbout,
  ];
  for (const control of controls) {
    if (!(await ui.get(control).isVisible())) return false;
  }
  return true;
}
