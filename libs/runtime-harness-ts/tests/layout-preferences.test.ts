import '@libs/harness-ts/preload';

import { expect, test } from 'bun:test';
import {
  changeAvailableSpace,
  layoutPlaceAndPreferences,
  saveLayoutPreferences,
} from '@libs/runtime-harness-ts/device-layout';
import { openHarness } from './open-app-harness';

// regression: wide-layout-preferences-compact-back
// Match this package's full-composition integration timeout (the party review
// contract); each UI operation still has its unchanged 15-second deadline.
test('preference setup reaches Settings through wide subscreen chrome', async () => {
  await using s = await openHarness('wide-layout-preferences-compact-back');
  await s.apply(changeAvailableSpace, 'alice', 1180, 820);
  await s.apply(saveLayoutPreferences, 'alice');
  const saved = await s.read(layoutPlaceAndPreferences, 'alice');
  expect(saved.place).toBe('/more');
  expect(saved.appearance).toBe('dark');
  expect(saved.sounds).toContain('Muted');
}, 240_000);
