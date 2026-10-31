import '@libs/harness-ts/preload';

import { expect, test } from 'bun:test';
import {
  changeAvailableSpace,
  layoutControlsReachable,
  layoutPlaceAndPreferences,
  saveLayoutPreferences,
} from '@libs/runtime-harness-ts/device-layout';
import { openHarness } from './open-app-harness';

// regression: settings-navigation-assumes-compact-back
test('tablet settings keep preferences without a compact back button', async () => {
  await using s = await openHarness('tablet-settings-navigation');
  await s.apply(changeAvailableSpace, 'alice', 1180, 820);
  await s.apply(saveLayoutPreferences, 'alice');
  const before = await s.read(layoutPlaceAndPreferences, 'alice');
  expect(before.place).toBe('/more');
  expect(before.appearance).toBe('dark');
  expect(before.sounds).toContain('Muted');
  await s.apply(changeAvailableSpace, 'alice', 820, 1180);
  expect(await s.read(layoutPlaceAndPreferences, 'alice')).toEqual(before);
  expect(await s.read(layoutControlsReachable, 'alice')).toBe(true);
});
