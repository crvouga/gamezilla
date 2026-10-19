/** @jsxImportSource solid-js */

import { Handles } from '@libs/test-ids-shared/handles';
import { ClockProvider } from '@pkgs/clock-client/solid';
import { KvProvider } from '@pkgs/kv-root-client/solid';
import {
  SoundsPreferenceProvider,
  useSoundsPreference,
} from '@pkgs/sounds-client/solid';
import { createRoot } from 'solid-js';
import { actorUi, scenarioAction } from './actor-ui';
import type { ProductHarness } from './harness';
import { openSettings } from './shell-actions';

/** Observe the persisted preference through its public provider and real Kv. */
export async function readSoundsOn(s: ProductHarness, actor: string) {
  const env = await s.harness.client(actor);
  let read = () => false;
  const dispose = createRoot((cleanup) => {
    const Probe = () => {
      const preference = useSoundsPreference();
      read = () => !preference.muted();
      return null;
    };
    <ClockProvider clock={env.clock} timers={env.timers}>
      <KvProvider value={env.kv}>
        <SoundsPreferenceProvider>
          <Probe />
        </SoundsPreferenceProvider>
      </KvProvider>
    </ClockProvider>;
    return cleanup;
  });
  try {
    await s.session.waitForIdle();
    return read();
  } finally {
    dispose();
  }
}

/**
 * Turn the app's sounds on or off through the real Settings switch, then
 * return to what the person was doing.
 */
export const configureSounds = scenarioAction({
  name: 'configureSounds',
  async act(s, actor: string, on: boolean) {
    const ui = await actorUi(s, actor);
    const handle = s.actors.get(actor);
    if (handle === undefined) throw new Error('Missing sound preference actor');
    const path = await handle.currentPath();
    const current = await readSoundsOn(s, actor);
    await Promise.resolve(openSettings.act(s, actor));
    await ui.get(Handles.settingsSound).tap({ timeoutMs: 15_000 });
    if (current !== on)
      await ui.get(Handles.soundEffectsSwitch).tap({ timeoutMs: 15_000 });
    await s.session.waitForIdle();
    await handle.openLink(path);
    await s.session.waitForIdle();
  },
});
