/** @jsxImportSource solid-js */
import { actorUi, scenarioAction } from '@libs/harness/actor-ui';
import type { ProductHarness } from '@libs/harness/harness';
import { openSettings } from '@libs/harness/shell-actions';
import { Handles } from '@libs/test-ids-shared/handles';
import { ClockProvider } from '@pkgs/clock-client/solid';
import { KvProvider } from '@pkgs/kv-root-client/solid';
import {
  SoundsPreferenceProvider,
  useSoundsPreference,
} from '@pkgs/sounds-client/solid';
import { createRoot } from 'solid-js';

/** Observe the persisted preference through its public provider and real Kv. */
export async function readPuzzleSoundsOn(s: ProductHarness, actor: string) {
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

/** Change Settings through the real switch, then return to the prior activity. */
export const configurePuzzleSounds = scenarioAction({
  name: 'configurePuzzleSounds',
  async act(s, actor: string, on: boolean) {
    const ui = await actorUi(s, actor);
    const handle = s.actors.get(actor);
    if (handle === undefined) throw new Error('Missing sound preference actor');
    const path = await handle.currentPath();
    const current = await readPuzzleSoundsOn(s, actor);
    await Promise.resolve(openSettings.act(s, actor));
    await ui.get(Handles.settingsSound).tap({ timeoutMs: 15_000 });
    if (current !== on)
      await ui.get(Handles.soundEffectsSwitch).tap({ timeoutMs: 15_000 });
    await s.session.waitForIdle();
    await handle.openLink(path);
    await s.session.waitForIdle();
  },
});
