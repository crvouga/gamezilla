/**
 * Settings a person sets once and expects kept: the appearance, sounds, and
 * the About screen's version. Stimuli go through Settings as a person would;
 * reads look at what the app shows.
 */

import { APP_VERSION } from '@libs/client-app/config/app-metadata';
import {
  actorHtml,
  actorUi,
  backToTabs,
  nodeText,
  openSettings,
  type ProductHarness,
  scenarioAction,
} from '@libs/harness';
import { Handles } from '@libs/test-ids';

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

/** The version the About screen shows, or `null` off About. */
export async function versionShownInAbout(
  s: ProductHarness,
  actorId: string
): Promise<string | null> {
  return nodeText(s, actorId, [Handles.aboutVersion]);
}
