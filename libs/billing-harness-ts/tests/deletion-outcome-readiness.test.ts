import '@libs/harness-ts/preload';

import { expect, test } from 'bun:test';
import {
  confirmDeletion,
  openPrivacy,
  privacyTimePasses,
  proveAccount,
} from '@libs/account-privacy-harness-ts/privacy-actions';
import { privacyText } from '@libs/account-privacy-harness-ts/privacy-reads';
import {
  makeMembershipPayment,
  pauseCancellation,
} from '@libs/billing-harness-ts/account-privacy';
import {
  openBilling,
  subscribeToPlus,
} from '@libs/billing-harness-ts/billing-actions';
import { signInWithGoogle } from '@libs/harness-ts/auth-actions';
import { signedInAccountOf } from '@libs/harness-ts/identity';
import { openHarness } from './open-billing-harness';

// regression: privacy-receipt-waits-for-deletion-permission
test('the deleted account can reopen its pending cancellation receipt', async () => {
  await using s = await openHarness('pending-cancellation-receipt');
  await s.apply(signInWithGoogle, 'alice');
  await s.apply(openBilling, 'alice');
  await s.apply(subscribeToPlus, 'alice');
  await s.apply(privacyTimePasses, 7 * 86_400_000 + 1_000);
  await s.apply(
    makeMembershipPayment,
    String(await s.read(signedInAccountOf, 'alice'))
  );
  await s.apply(pauseCancellation);
  await s.apply(proveAccount, 'alice');
  await s.apply(confirmDeletion, 'alice');
  await s.apply(openPrivacy, 'alice');
  const outcome = await s.read(
    privacyText,
    'alice',
    'privacy-cancellation-outcome'
  );
  expect(outcome).toContain('still being completed');
  expect(outcome).not.toContain('has completed');
}, 240_000);
