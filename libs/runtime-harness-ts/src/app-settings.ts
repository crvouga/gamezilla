import { chooseOfflineCommand } from '@libs/harness-ts/offline-gestures';
/**
 * Settings a person sets once and expects kept: sounds and
 * the About screen's version. Stimuli go through Settings as a person would;
 * reads look at what the app shows.
 */

import { APP_VERSION } from '@libs/app-root-shared-ts/app-metadata';
import { actorUi, scenarioAction } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { nodeText, visible } from '@libs/harness-ts/observations';
import { openSettings } from '@libs/harness-ts/shell-actions';
import { Handles } from '@libs/test-ids-shared-ts/handles';

const WAIT_MS = 15_000;

/** The version of the app every simulated device runs. */
export const APP_VERSION_INSTALLED = APP_VERSION;

/** Settings → Sound → sound effects off. */
export const turnSoundsOff = scenarioAction({
  name: 'turnSoundsOff',
  act: async (s, actorId: string) => {
    await Promise.resolve(openSettings.act(s, actorId));
    const ui = await actorUi(s, actorId);
    await ui.get(Handles.settingsSound).tap({ timeoutMs: WAIT_MS });
    const sound = ui.get(Handles.soundEffectsSwitch);
    if ((await sound.attribute('aria-checked')) === 'true')
      await sound.tap({ timeoutMs: WAIT_MS });
    await s.session.waitForIdle();
  },
});

/** Whether the Settings Work offline switch is on, or `null` off Settings. */
async function offlineSwitchOn(
  s: ProductHarness,
  actorId: string
): Promise<boolean | null> {
  if ((await nodeText(s, actorId, [Handles.settingsWorkOffline])) === null)
    return null;
  const ui = await actorUi(s, actorId);
  const checked = await ui
    .get(Handles.settingsWorkOfflineSwitch)
    .attribute('aria-checked');
  return checked === null ? null : checked === 'true';
}

/** Settings → Work offline switch. */
export const setWorkOfflineInSettings = scenarioAction({
  name: 'setWorkOfflineInSettings',
  act: async (s, actorId: string, offline: boolean) => {
    await Promise.resolve(openSettings.act(s, actorId));
    const ui = await actorUi(s, actorId);
    const isOffline = (await offlineSwitchOn(s, actorId)) === true;
    if (isOffline !== offline) {
      await ui
        .get(Handles.settingsWorkOfflineSwitch)
        .tap({ timeoutMs: WAIT_MS });
      await s.session.waitForIdle();
    }
  },
});

/** Settings → command palette → Work offline / Work online. */
export const setWorkOfflineInCommandPalette = scenarioAction({
  name: 'setWorkOfflineInCommandPalette',
  act: async (s, actorId: string, offline: boolean) => {
    await Promise.resolve(openSettings.act(s, actorId));
    await chooseOfflineCommand(s, actorId, offline);
  },
});

/** Command palette toggle without moving away from the person's current place. */
export const setWorkOfflineFromCurrentPlace = scenarioAction({
  name: 'setWorkOfflineFromCurrentPlace',
  act: async (s, actorId: string, offline: boolean) => {
    await chooseOfflineCommand(s, actorId, offline);
  },
});

/** Settings → About. */
export const openAbout = scenarioAction({
  name: 'openAbout',
  act: async (s, actorId: string) => {
    await Promise.resolve(openSettings.act(s, actorId));
    const ui = await actorUi(s, actorId);
    await ui.get(Handles.settingsAbout).tap({ timeoutMs: WAIT_MS });
    await ui.get(Handles.aboutVersion).expect.visible({ timeoutMs: WAIT_MS });
  },
});

/** What Settings says about sound (`On` / `Muted`), or `null` off Settings. */
export async function soundShownInSettings(
  s: ProductHarness,
  actorId: string
): Promise<string | null> {
  return nodeText(s, actorId, [Handles.settingsSound]);
}

/**
 * What the Settings Work offline row shows (`Offline` while its switch is
 * on, `Online` while it is off), or `null` off Settings.
 */
export async function workOfflineShownInSettings(
  s: ProductHarness,
  actorId: string
): Promise<string | null> {
  const on = await offlineSwitchOn(s, actorId);
  if (on === null) return null;
  return on ? 'Offline' : 'Online';
}

/** The sign-in error shown after an online-only attempt. */
export async function signInFailureShown(
  s: ProductHarness,
  actorId: string
): Promise<string | null> {
  return nodeText(s, actorId, [Handles.authSignInFailed]);
}

/** The visible offline badge, available from every place in the app. */
export async function workingOfflineChoice(
  s: ProductHarness,
  actorId: string
): Promise<boolean> {
  const ui = await actorUi(s, actorId);
  return ui.get(Handles.statusWorkOffline).isVisible();
}

/** The version the About screen shows, or `null` off About. */
export async function versionShownInAbout(
  s: ProductHarness,
  actorId: string
): Promise<string | null> {
  return nodeText(s, actorId, [Handles.aboutVersion]);
}

/**
 * Settings → Troubleshooting → Connection: whether the app is connected and
 * what works without it. Connection sits on the Troubleshooting page, so a
 * person opens that first.
 */
export const openConnectionInSettings = scenarioAction({
  name: 'openConnectionInSettings',
  act: async (s, actorId: string) => {
    await Promise.resolve(openSettings.act(s, actorId));
    const ui = await actorUi(s, actorId);
    await ui.get(Handles.settingsTroubleshooting).tap({ timeoutMs: WAIT_MS });
    await ui.get(Handles.settingsConnection).tap({ timeoutMs: WAIT_MS });
    await s.session.waitForIdle();
  },
});

/** Which connection state Connection in Settings shows, or `null` off it. */
export async function connectionStateShown(
  s: ProductHarness,
  actorId: string
): Promise<'connected' | 'missing' | 'checking' | null> {
  for (const state of ['connected', 'missing', 'checking'] as const) {
    if (await visible(s, actorId, [Handles.connectionState(state)]))
      return state;
  }
  return null;
}

/** What Connection in Settings says still works without a connection. */
export function withoutConnectionShown(
  s: ProductHarness,
  actorId: string
): Promise<string | null> {
  return nodeText(s, actorId, [Handles.connectionWithoutConnection]);
}
