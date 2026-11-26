/**
 * Wall-time-tolerant gestures over a bare {@link Driver}: no harness, no session.
 * Scenario actions use them on pumped virtual time; the production critical
 * journeys (`specs/journeys/`, `@libs/runtime/harness/critical-journeys`) use them
 * on a real browser.
 */

import { Handles } from '@libs/test-ids-shared-ts/handles';
import type { Driver } from '@pkgs/ui-testing-root-shared-ts/driver';

const BACK_PRESS_LIMIT = 3;
const BACK_SETTLE_MS = 2_000;

/**
 * Press the chrome back arrow until `target` shows. On wall time a press can
 * land while the previous screen's chrome is still swapping out and be lost —
 * a user presses again. Virtual time settles first, so one press lands.
 */
export async function pressBackUntilVisible(
  ui: Driver,
  target: string,
  timeoutMs: number
): Promise<void> {
  const goal = ui.get(target);
  const back = ui.get(Handles.navBack);
  for (let press = 0; press < BACK_PRESS_LIMIT; press += 1) {
    if (await goal.isVisible()) return;
    // A screen with no back control (the tab shell, still painting) must not
    // spend the whole wait on nav-back. The goal showing is the success.
    if (!(await back.isVisible())) {
      await goal.expect.visible({ timeoutMs });
      return;
    }
    await back.tap({ timeoutMs });
    try {
      await goal.expect.visible({ timeoutMs: BACK_SETTLE_MS });
      return;
    } catch {
      // The press landed mid-transition; press again.
    }
  }
  await goal.expect.visible({ timeoutMs });
}

/**
 * The app is in front and painted. Outside a space that is the account menu;
 * an open space's top bar is the space's alone, so there it is the Minimize button.
 */
export async function shellShown(ui: Driver): Promise<boolean> {
  return (
    (await ui.get(Handles.statusCurrentUser).isVisible()) ||
    (await ui.get(Handles.spaceClose).isVisible())
  );
}

/** Wait for {@link shellShown}. */
export async function expectShellShown(
  ui: Driver,
  timeoutMs?: number
): Promise<void> {
  if (await shellShown(ui)) return;
  await ui.get(Handles.statusCurrentUser).wait('visible', {
    ...(timeoutMs === undefined ? {} : { timeoutMs }),
    description: 'the account menu, or the top bar of an open space',
    visibleOr: [Handles.spaceClose],
  });
}

const SPACE_WAIT_MS = 15_000;

/** Minimize is present on every open space, including its loading stage. */
export async function spaceBarShown(ui: Driver): Promise<boolean> {
  return ui.get(Handles.spaceClose).isVisible();
}

export async function minimizeSpace(
  ui: Driver,
  timeoutMs: number = SPACE_WAIT_MS
): Promise<void> {
  await ui.get(Handles.spaceClose).tap({ timeoutMs });
}

/** How many screens deep inside a space a person may be. */
const SPACE_DEPTH_LIMIT = 8;

/**
 * The account menu's button. An open space's top bar is the space's alone,
 * so a person in one minimizes it first (the space goes on behind them);
 * beside a sidebar the account menu is already visible.
 */
export async function reachAccountMenu(
  ui: Driver,
  timeoutMs: number
): Promise<ReturnType<Driver['get']>> {
  const account = ui.get(Handles.statusCurrentUser);
  for (let press = 0; press < SPACE_DEPTH_LIMIT; press += 1) {
    if ((await account.isVisible()) || !(await spaceBarShown(ui))) break;
    await minimizeSpace(ui, timeoutMs);
    await expectShellShown(ui, timeoutMs);
  }
  return account;
}

const MENU_OPEN_LIMIT = 3;
const MENU_SETTLE_MS = 2_000;

/**
 * Open the avatar (global) menu until `item` shows. On wall time a data
 * refresh can re-render the trigger and close the menu right after it opens —
 * a user taps again. Virtual time settles first, so one tap opens it.
 */
export async function openGlobalMenu(
  ui: Driver,
  item: string,
  timeoutMs: number
): Promise<void> {
  const goal = ui.get(item);
  for (let tap = 0; tap < MENU_OPEN_LIMIT; tap += 1) {
    if (await goal.isVisible()) return;
    const trigger = await reachAccountMenu(ui, timeoutMs);
    if ((await trigger.attribute('aria-expanded')) === 'true') {
      await goal.expect.visible({ timeoutMs });
      return;
    }
    try {
      await trigger.tap({ timeoutMs });
    } catch (error) {
      // The app remounted under its boot overlay mid-tap; once it is ready
      // the person taps again.
      if (!(await ui.get(Handles.bootLoading).isVisible())) throw error;
      await ui.get(Handles.bootLoading).expect.hidden({ timeoutMs });
      continue;
    }
    try {
      await goal.expect.visible({ timeoutMs: MENU_SETTLE_MS });
      return;
    } catch {
      // The menu closed under a re-render; open it again.
    }
  }
  await goal.expect.visible({ timeoutMs });
}

/** Select while the menu is open; hydration may close it after the visible read. */
export async function chooseGlobalMenuItem(
  ui: Driver,
  item: string,
  timeoutMs: number
): Promise<void> {
  const goal = ui.get(item);
  for (let attempt = 0; attempt < MENU_OPEN_LIMIT; attempt += 1) {
    await openGlobalMenu(ui, item, timeoutMs);
    try {
      await goal.tap({ timeoutMs: MENU_SETTLE_MS });
      return;
    } catch (error) {
      if (await goal.isVisible()) throw error;
    }
  }
  await goal.tap({ timeoutMs });
}
