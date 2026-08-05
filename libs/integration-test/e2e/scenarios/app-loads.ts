import {
  by,
  expectVisible,
  first,
} from '@pkgs/ui-testing';

import type { TestApp } from '../support/test-app';

const BOOT_TIMEOUT_MS = 60_000;

/**
 * Driver-agnostic smoke: app shell boots to the Spaces screen.
 * Same scenario runs on web today; in-process / native bindings later.
 */
export async function appLoadsScenario(app: TestApp): Promise<void> {
  const { driver } = app;
  await expectVisible(driver, by.testId('app-root'), {
    timeoutMs: BOOT_TIMEOUT_MS,
  });
  await expectVisible(driver, first(by.role('heading', 'Spaces')), {
    timeoutMs: BOOT_TIMEOUT_MS,
  });
  await expectVisible(driver, by.testId('screen-spaces'), {
    timeoutMs: BOOT_TIMEOUT_MS,
  });
}
