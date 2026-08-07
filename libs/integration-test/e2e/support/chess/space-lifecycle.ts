import {
  by,
  type Driver,
  expectHidden,
  expectVisible,
  first,
} from '@pkgs/ui-testing';

import type { TestApp } from '../test-app';

const SPACE_NAV_TIMEOUT_MS = 60_000;

export async function goToSpacesHome(app: TestApp): Promise<void> {
  const { driver } = app;
  if (await driver.isVisible(by.role('button', 'Go to spaces'))) {
    await driver.tap(by.role('button', 'Go to spaces'));
  } else if (await driver.isVisible(by.role('button', 'Spaces'))) {
    await driver.tap(by.role('button', 'Spaces'));
  } else {
    await app.open('/');
  }
  await expectVisible(driver, first(by.role('heading', 'Spaces')), {
    timeoutMs: SPACE_NAV_TIMEOUT_MS,
  });
}

async function clickMutationSubmit(
  driver: Driver,
  label: string
): Promise<void> {
  await expectVisible(driver, by.role('button', label), {
    timeoutMs: 10_000,
  });
  await driver.tap(by.role('button', label));
}

export async function confirmEndSpace(driver: Driver): Promise<void> {
  await expectVisible(driver, by.text('End space?'), { timeoutMs: 10_000 });
  await clickMutationSubmit(driver, 'End space');
}

export async function dismissSpaceEnded(driver: Driver): Promise<void> {
  await expectVisible(driver, by.text('Space ended', { exact: true }), {
    timeoutMs: 30_000,
  });
  await driver.tap(by.text('Done'));
  await expectHidden(driver, by.text('Space ended', { exact: true }), {
    timeoutMs: 10_000,
  });
}

export async function endActiveSpaceFromLobby(app: TestApp): Promise<void> {
  const { driver } = app;
  if (!(await driver.isVisible(by.role('button', 'Return to your space')))) {
    return;
  }
  await driver.tap(by.role('button', 'Return to your space'));
  if (!(await driver.isVisible(by.role('button', 'End space')))) {
    await goToSpacesHome(app);
    return;
  }
  await driver.tap(by.role('button', 'End space'));
  await confirmEndSpace(driver);
  await dismissSpaceEnded(driver);
  await goToSpacesHome(app);
}

export async function ensureNoActiveSpaceBlockingCreate(
  app: TestApp
): Promise<void> {
  if (await app.driver.isVisible(by.role('button', 'New space'))) {
    return;
  }
  if (await app.driver.isVisible(by.role('button', 'Return to your space'))) {
    await endActiveSpaceFromLobby(app);
  }
}
