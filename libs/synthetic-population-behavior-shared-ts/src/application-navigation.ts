import { Handles } from '@libs/test-ids-shared-ts/handles';
import type { Driver } from '@pkgs/ui-testing-root-shared-ts/driver';
import {
  EMPTY_INVENTORY,
  hasInventory,
} from '@pkgs/ui-testing-root-shared-ts/inventory';
import { leaveSpace } from './application-actions';

export async function observeAvailableSpaces(
  driver: Driver
): Promise<string[]> {
  const inventory = hasInventory(driver)
    ? await driver.inventory()
    : EMPTY_INVENTORY;
  return inventory.pressables
    .filter((item) => item.testId.startsWith('space-card-'))
    .map((item) => item.testId)
    .slice(0, 32);
}

export async function isMatchParticipant(driver: Driver): Promise<boolean> {
  // The shared seat renders this control only for its authorized participant.
  return driver.get('multiplayer-colour').isVisible();
}

export async function returnToSpaces(driver: Driver): Promise<void> {
  await leaveSpace(driver);
  for (
    let depth = 0;
    depth < 8 && !(await driver.get(Handles.tabSpaces).isVisible());
    depth += 1
  ) {
    if (!(await driver.get(Handles.navBack).isVisible())) break;
    await driver.get(Handles.navBack).tap();
  }
  if (await driver.get(Handles.tabSpaces).isVisible())
    await driver.get(Handles.tabSpaces).tap();
}
