import '@libs/harness-ts/preload';

import { expect, test } from 'bun:test';
import {
  askForExport,
  openPrivacy,
  privacyTimePasses,
  proveAccount,
} from '@libs/account-privacy-harness-ts/privacy-actions';
import { privacyNotice } from '@libs/account-privacy-harness-ts/privacy-reads';
import { openHarness } from './open-profile-harness';

// regression: overdue-export-retry-requires-fresh-proof
test('an overdue export offers fresh proof and can be requested again after sign-in', async () => {
  await using s = await openHarness('overdue-export-proof');
  await s.apply(proveAccount, 'alice');
  await s.apply(askForExport, 'alice');
  await s.apply(privacyTimePasses, 24 * 3_600_000, false);
  await s.apply(openPrivacy, 'alice');
  expect(
    await s.read(privacyNotice, 'alice', 'privacy-export-overdue')
  ).toContain('ask again');
  expect(
    await s.read(privacyNotice, 'alice', 'privacy-export-access-action')
  ).toBe('Sign in');
  expect(
    await s.read(privacyNotice, 'alice', 'privacy-export-request')
  ).toBeNull();
  await s.apply(proveAccount, 'alice');
  await s.apply(askForExport, 'alice');
  expect(
    await s.read(privacyNotice, 'alice', 'privacy-export-preparing')
  ).toContain('within 24 hours');
  expect(
    await s.read(privacyNotice, 'alice', 'privacy-export-overdue')
  ).toBeNull();
}, 240_000);
