import { by, type Driver, expectVisible, first } from '@pkgs/ui-testing';

import type { TestApp } from './test-app';

const BOOT_TIMEOUT_MS = 60_000;

/** Navigates to a fresh DB session and waits until the spaces shell is ready. */
export async function expectAppBooted(app: TestApp): Promise<void> {
  await app.open('/?reset-db=1');
  await expectSpacesShell(app.driver);
}

/** Asserts the spaces home shell without navigating. */
export async function expectSpacesShell(driver: Driver): Promise<void> {
  await expectVisible(driver, by.testId('app-root'), {
    timeoutMs: BOOT_TIMEOUT_MS,
  });
  await expectVisible(driver, first(by.role('heading', 'Spaces')), {
    timeoutMs: BOOT_TIMEOUT_MS,
  });
}
