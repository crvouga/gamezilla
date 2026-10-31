import { chooseOfflineCommand } from '@libs/harness-ts/offline-gestures';
/**
 * Settings a person sets once and expects kept: the appearance, sounds, and
 * the About screen's version. Stimuli go through Settings as a person would;
 * reads look at what the app shows.
 */

import { APP_VERSION } from '@libs/app-root-shared-ts/app-metadata';
import { actorUi, scenarioAction } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { actorHtml, nodeText, visible } from '@libs/harness-ts/observations';
import { openSettings } from '@libs/harness-ts/shell-actions';
import { Handles } from '@libs/test-ids-shared-ts/handles';

const WAIT_MS = 15_000;

/** The version of the app every simulated device runs. */
export const APP_VERSION_INSTALLED = APP_VERSION;

/** Settings → Appearance → `scheme`, then see the app take it on. */
export const chooseTheme = scenarioAction({
  name: 'chooseTheme',
  act: async (s, actorId: string, scheme: 'light' | 'dark') => {
    // The global menu reaches Settings from compact and wide subscreens.
    await Promise.resolve(openSettings.act(s, actorId));
    const ui = await actorUi(s, actorId);
    await ui.get(Handles.settingsTheme).tap({ timeoutMs: WAIT_MS });
    await ui.get(Handles.themeOption(scheme)).tap({ timeoutMs: WAIT_MS });
    await s.session.waitForIdle();
  },
});

/** Settings → Sound → sound effects off. */
export const turnSoundsOff = scenarioAction({
  name: 'turnSoundsOff',
  act: async (s, actorId: string) => {
    await Promise.resolve(openSettings.act(s, actorId));
    const ui = await actorUi(s, actorId);
    await ui.get(Handles.settingsSound).tap({ timeoutMs: WAIT_MS });
    await ui.get(Handles.soundEffectsSwitch).tap({ timeoutMs: WAIT_MS });
    await s.session.waitForIdle();
  },
});

/** Settings → Work offline switch. */
export const setWorkOfflineInSettings = scenarioAction({
  name: 'setWorkOfflineInSettings',
  act: async (s, actorId: string, offline: boolean) => {
    await Promise.resolve(openSettings.act(s, actorId));
    const ui = await actorUi(s, actorId);
    const shown = await nodeText(s, actorId, [Handles.settingsWorkOffline]);
    const isOffline = shown?.includes('Offline') === true;
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

const THEME_HOST = /class="themeHost"[^>]*data-theme="(light|dark)"/;

/** The appearance the app paints right now, or `null` before it paints. */
export async function appearanceShown(
  s: ProductHarness,
  actorId: string
): Promise<'light' | 'dark' | null> {
  const html = await actorHtml(s, actorId);
  const match = html === null ? null : THEME_HOST.exec(html);
  return match === null ? null : (match[1] as 'light' | 'dark');
}

/** What Settings says about sound (`On` / `Muted`), or `null` off Settings. */
export async function soundShownInSettings(
  s: ProductHarness,
  actorId: string
): Promise<string | null> {
  return nodeText(s, actorId, [Handles.settingsSound]);
}

/** What the Work offline row says (`Offline` / `Online`). */
export async function workOfflineShownInSettings(
  s: ProductHarness,
  actorId: string
): Promise<string | null> {
  return nodeText(s, actorId, [Handles.settingsWorkOffline]);
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

/** Settings → Connection: whether the app is connected and what works without it. */
export const openConnectionInSettings = scenarioAction({
  name: 'openConnectionInSettings',
  act: async (s, actorId: string) => {
    await Promise.resolve(openSettings.act(s, actorId));
    const ui = await actorUi(s, actorId);
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
