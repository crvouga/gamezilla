/**
 * Wall-time-tolerant gestures over a bare {@link Driver}: no harness, no session.
 * Scenario actions use them on pumped virtual time; the production critical
 * journeys (`specs/journeys/`, `@libs/runtime/harness/critical-journeys`) use them
 * on a real browser.
 */

import { Handles } from '@libs/test-ids';
import type { Driver } from '@pkgs/ui-testing';

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
    await ui.get(Handles.statusCurrentUser).tap({ timeoutMs });
    try {
      await goal.expect.visible({ timeoutMs: MENU_SETTLE_MS });
      return;
    } catch {
      // The menu closed under a re-render; open it again.
    }
  }
  await goal.expect.visible({ timeoutMs });
}
