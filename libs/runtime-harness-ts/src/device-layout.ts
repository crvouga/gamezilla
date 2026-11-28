import {
  actorUi,
  ensureActor,
  scenarioAction,
} from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { openSettings } from '@libs/harness-ts/shell-actions';
import { readSoundsOn } from '@libs/harness-ts/sounds-preference';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import { turnSoundsOff } from './app-settings';

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
    sounds: await readSoundsOn(s, actor),
  };
}
/** Offered Settings controls can be addressed and operated at every viewport. */
export async function layoutControlsReachable(
  s: ProductHarness,
  actor: string
) {
  const ui = await actorUi(s, actor);
  const controls = [Handles.settingsSound, Handles.settingsAbout];
  for (const control of controls) {
    if (!(await ui.get(control).isVisible())) return false;
  }
  return true;
}
