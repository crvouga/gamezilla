/**
 * Settings a person sets once and expects kept: the appearance, sounds, and
 * the About screen's version. Stimuli go through Settings as a person would;
 * reads look at what the app shows.
 */

import { APP_VERSION } from '@libs/app-root-shared/app-metadata';
import { actorUi, scenarioAction } from '@libs/harness/actor-ui';
import type { ProductHarness } from '@libs/harness/harness';
import { actorHtml, nodeText } from '@libs/harness/observations';
import { backToTabs, openSettings } from '@libs/harness/shell-actions';
import { Handles } from '@libs/test-ids-shared/handles';

const WAIT_MS = 15_000;

/** The version of the app every simulated device runs. */
export const APP_VERSION_INSTALLED = APP_VERSION;

/** Settings → Appearance → `scheme`, then see the app take it on. */
export const chooseTheme = scenarioAction({
  name: 'chooseTheme',
  act: async (s, actorId: string, scheme: 'light' | 'dark') => {
    const handle = s.actors.get(actorId);
    if (
      handle !== undefined &&
      (await handle.currentPath()).startsWith('/more')
    )
      await Promise.resolve(backToTabs.act(s, actorId));
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
    const handle = s.actors.get(actorId);
    if (
      handle !== undefined &&
      (await handle.currentPath()).startsWith('/more')
    )
      await Promise.resolve(backToTabs.act(s, actorId));
    await Promise.resolve(openSettings.act(s, actorId));
    const ui = await actorUi(s, actorId);
    await ui.get(Handles.settingsSound).tap({ timeoutMs: WAIT_MS });
    await ui.get(Handles.soundEffectsSwitch).tap({ timeoutMs: WAIT_MS });
    await s.session.waitForIdle();
  },
});

async function openSettingsFromAnywhere(
  s: ProductHarness,
  actorId: string
): Promise<void> {
  const handle = s.actors.get(actorId);
  if (
    handle !== undefined &&
    (await handle.currentPath()).startsWith('/more')
  ) {
    await Promise.resolve(backToTabs.act(s, actorId));
  }
  await Promise.resolve(openSettings.act(s, actorId));
}

/** Settings → Work offline switch. */
export const setWorkOfflineInSettings = scenarioAction({
  name: 'setWorkOfflineInSettings',
  act: async (s, actorId: string, offline: boolean) => {
    await openSettingsFromAnywhere(s, actorId);
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
    await openSettingsFromAnywhere(s, actorId);
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

async function chooseOfflineCommand(
  s: ProductHarness,
  actorId: string,
  offline: boolean
): Promise<void> {
  const ui = await actorUi(s, actorId);
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

/** Settings → About. */
export const openAbout = scenarioAction({
  name: 'openAbout',
  act: async (s, actorId: string) => {
    const handle = s.actors.get(actorId);
    if (
      handle !== undefined &&
      (await handle.currentPath()).startsWith('/more')
    )
      await Promise.resolve(backToTabs.act(s, actorId));
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
