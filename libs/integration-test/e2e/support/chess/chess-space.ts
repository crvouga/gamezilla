import { by, type Driver, expectVisible } from '@pkgs/ui-testing';

import type { TestApp } from '../test-app';
import {
  ensureNoActiveSpaceBlockingCreate,
  goToSpacesHome,
} from './space-lifecycle';

const SPACE_NAV_TIMEOUT_MS = 60_000;
const JOIN_PROMPT_COPY = 'Join to see who is here';

/** Host game rows are Pressable (`role="button"`). */
export function hostChessSelector() {
  return by.role('button', 'Chess');
}

export async function isHostGamesPickerVisible(
  driver: Driver
): Promise<boolean> {
  return driver.isVisible(hostChessSelector());
}

export async function isSpaceJoinPromptVisible(
  driver: Driver
): Promise<boolean> {
  return driver.isVisible(by.text(JOIN_PROMPT_COPY));
}

/**
 * Lands on the space games picker with a host-selectable Chess row.
 * Always creates a fresh hosted space — never opens shared spaces as a guest.
 */
export async function createSpaceIfNeeded(app: TestApp): Promise<void> {
  if (await isHostGamesPickerVisible(app.driver)) return;

  await goToSpacesHome(app);
  await ensureNoActiveSpaceBlockingCreate(app);

  const newSpace = by.role('button', 'New space');
  await expectVisible(app.driver, newSpace, {
    timeoutMs: SPACE_NAV_TIMEOUT_MS,
  });
  await app.driver.tap(newSpace);
  await expectVisible(app.driver, hostChessSelector(), {
    timeoutMs: SPACE_NAV_TIMEOUT_MS,
  });
}

export async function reestablishHostSpace(app: TestApp): Promise<void> {
  await goToSpacesHome(app);
  await ensureNoActiveSpaceBlockingCreate(app);
  const newSpace = by.role('button', 'New space');
  await expectVisible(app.driver, newSpace, {
    timeoutMs: SPACE_NAV_TIMEOUT_MS,
  });
  await app.driver.tap(newSpace);
  await expectVisible(app.driver, hostChessSelector(), {
    timeoutMs: SPACE_NAV_TIMEOUT_MS,
  });
}
