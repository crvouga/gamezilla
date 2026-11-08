import '@libs/harness-ts/preload';

import { expect, test } from 'bun:test';
import {
  confirmDeletion,
  proveAccount,
} from '@libs/account-privacy-harness-ts/privacy-actions';
import {
  privacyNotice,
  privacyStatus,
} from '@libs/account-privacy-harness-ts/privacy-reads';
import { signedInAccountOf } from '@libs/harness-ts/identity';
import { openHarness } from './open-profile-harness';

// regression: privacy-denial-replaces-action-control
test('expired proof shows a visible refusal and leaves the account active', async () => {
  await using s = await openHarness('privacy-old-proof-refusal');
  await s.apply(proveAccount, 'alice');
  const accountId = await s.read(signedInAccountOf, 'alice');
  expect(accountId).not.toBeNull();
  await s.advanceTime(600_001);
  await s.apply(confirmDeletion, 'alice');
  expect(
    await s.read(privacyNotice, 'alice', 'privacy-delete-access')
  ).toContain('Prove the account again');
  expect(await s.read(signedInAccountOf, 'alice')).toBe(accountId);
  expect(await s.read(privacyStatus, String(accountId))).toMatchObject({
    deletion: 'Active',
    eraseBy: null,
  });
}, 240_000);
