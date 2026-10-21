/**
 * A saved preference survives an unfinished choice and a stretch of trouble.
 * Stimuli are what a person does; reads are what the app shows afterwards.
 */

import { actorUi, scenarioAction } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { visible } from '@libs/harness-ts/observations';
import { HARNESS_PRIMARY_SERVER_ID } from '@libs/harness-ts/server-nodes';
import {
  backToTabs,
  openSettings,
  openTab,
} from '@libs/harness-ts/shell-actions';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import { appearanceShown } from './app-settings';

const WAIT_MS = 15_000;
const TROUBLE_MS = 1_000;

/** Settings → Appearance, without choosing a theme. */
export const openThemeChoices = scenarioAction({
  name: 'openThemeChoices',
  act: async (s, actorId: string) => {
    const ui = await actorUi(s, actorId);
    if (!(await ui.get(Handles.settingsTheme).isVisible())) {
      const handle = s.actors.get(actorId);
      if (
        handle !== undefined &&
        (await handle.currentPath()).startsWith('/more')
      ) {
        await Promise.resolve(backToTabs.act(s, actorId));
      }
      await Promise.resolve(openSettings.act(s, actorId));
    }
    await ui.get(Handles.settingsTheme).tap({ timeoutMs: WAIT_MS });
    await ui
      .get(Handles.themeOption('light'))
      .expect.visible({ timeoutMs: WAIT_MS });
    await s.session.waitForIdle();
  },
});

/** Appearance → Light, then back to Settings. The choice is saved. */
export const chooseLightTheme = scenarioAction({
  name: 'chooseLightTheme',
  act: async (s, actorId: string) => {
    const ui = await actorUi(s, actorId);
    await ui.get(Handles.themeOption('light')).tap({ timeoutMs: WAIT_MS });
    await s.session.waitForIdle();
    if (await ui.get(Handles.navBack).isVisible()) {
      await ui.get(Handles.navBack).tap({ timeoutMs: WAIT_MS });
      await s.session.waitForIdle();
    }
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
  if (path.includes('/more') || path.includes('theme')) return 'settings';
  return 'spaces';
}

/** The theme choices are open. */
export async function themeChoicesOpen(
  s: ProductHarness,
  actorId: string
): Promise<boolean> {
  return visible(s, actorId, [Handles.themeOption('light')]);
}

/** The theme the app is showing: dark unless it is visibly light. */
export async function themeShown(
  s: ProductHarness,
  actorId: string
): Promise<string> {
  const shown = await appearanceShown(s, actorId);
  return shown === 'light' ? 'light' : 'dark';
}
