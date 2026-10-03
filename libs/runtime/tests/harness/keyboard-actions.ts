/**
 * How a person gets around the app: by pointer (the default), or by the
 * keyboard alone once they are said to be using it. Opening a tab or
 * Settings and coming back from Settings go through whichever the person
 * uses; by keyboard that is Tab to the control, then Enter (and the arrow
 * keys inside a menu), exactly the keys a keyboard user presses.
 */

import {
  actorUi,
  type ProductHarness,
  pollUntil,
  scenarioAction,
} from '@libs/harness';
import {
  actorPage,
  keyboardElement,
  keyboardPlace,
  keyboardToStart,
  pressTab,
  tabTo,
} from '@libs/harness/system/actor-page';
import {
  backToTabs,
  openSettings,
  openTab,
} from '@libs/harness/system/shell-actions';
import { Handles } from '@libs/test-ids';
import { sequentialFocusOrder } from '@pkgs/a11y';
import {
  recordKeyboardBeforeSettings,
  recordKeyboardVisits,
  usesKeyboard,
} from './people';

const WAIT_MS = 15_000;

/** The tabs a person can open, by name. */
export const TAB_HANDLES = {
  spaces: Handles.tabSpaces,
  notifications: Handles.tabNotifications,
  profile: Handles.tabProfile,
} as const;

export type TabName = keyof typeof TAB_HANDLES;

function on(page: HTMLElement, testId: string): boolean {
  return keyboardElement(page)?.getAttribute('data-testid') === testId;
}

async function pressKey(
  s: ProductHarness,
  actorId: string,
  key: 'enter' | 'arrowDown'
): Promise<void> {
  const ui = await actorUi(s, actorId);
  await ui.key(key);
  await s.session.waitForIdle();
}

/** Open a tab by pointer, or Tab to it and press Enter. */
export const openTabAs = scenarioAction({
  name: 'openTabAs',
  act: async (s, actorId: string, tab: TabName) => {
    const handle = TAB_HANDLES[tab];
    if (!usesKeyboard(s, actorId)) {
      await Promise.resolve(openTab.act(s, actorId, handle));
      return;
    }
    await tabTo(s, actorId, handle);
    await pressKey(s, actorId, 'enter');
  },
});

/** In the open account menu, arrow down to Settings and press Enter. */
async function chooseSettingsInMenu(
  s: ProductHarness,
  actorId: string
): Promise<void> {
  const page = await actorPage(s, actorId);
  await pollUntil(
    s,
    () => Promise.resolve(keyboardElement(page) === null ? null : true),
    { maxMs: WAIT_MS, description: 'the menu to take the keyboard' }
  );
  const items = page.querySelectorAll('[role="menuitem"]').length;
  for (let press = 0; press <= items; press += 1) {
    if (on(page, Handles.globalMenuSettings)) break;
    await pressKey(s, actorId, 'arrowDown');
  }
  await pressKey(s, actorId, 'enter');
}

/**
 * Open Settings by pointer, or: Tab to the account menu, Enter, arrow down to
 * Settings, Enter. Where the keyboard was just before is remembered.
 */
export const openSettingsAs = scenarioAction({
  name: 'openSettingsAs',
  act: async (s, actorId: string) => {
    if (!usesKeyboard(s, actorId)) {
      await Promise.resolve(openSettings.act(s, actorId));
      return;
    }
    await tabTo(s, actorId, Handles.statusCurrentUser);
    const page = await actorPage(s, actorId);
    recordKeyboardBeforeSettings(s, actorId, keyboardPlace(page));
    await pressKey(s, actorId, 'enter');
    await chooseSettingsInMenu(s, actorId);
    const ui = await actorUi(s, actorId);
    await ui.get(Handles.tabSpaces).expect.hidden({ timeoutMs: WAIT_MS });
  },
});

/** Leave Settings for the tabs: the back control, by pointer or by keyboard. */
export const comeBackFromSettings = scenarioAction({
  name: 'comeBackFromSettings',
  act: async (s, actorId: string) => {
    if (!usesKeyboard(s, actorId)) {
      await Promise.resolve(backToTabs.act(s, actorId));
      return;
    }
    await tabTo(s, actorId, Handles.navBack);
    await pressKey(s, actorId, 'enter');
    const ui = await actorUi(s, actorId);
    await ui.get(Handles.tabSpaces).expect.visible({ timeoutMs: WAIT_MS });
  },
});

/** Put the keyboard at the start of the page, then press Tab until it leaves. */
export const moveKeyboardThroughPage = scenarioAction({
  name: 'moveKeyboardThroughPage',
  act: async (s, actorId: string) => {
    const page = await actorPage(s, actorId);
    keyboardToStart(page);
    const visits: string[] = [];
    const bound = 2 * (sequentialFocusOrder(page).length + 1);
    for (let press = 0; press < bound; press += 1) {
      await pressTab(s, page);
      const place = keyboardPlace(page);
      if (place === null) break;
      visits.push(place);
    }
    recordKeyboardVisits(s, actorId, visits);
  },
});
