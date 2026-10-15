import { expect, test } from 'bun:test';
import { signInWithApple } from '@libs/harness/auth-actions';
import {
  deviceMemberIdOf,
  localSignInMethodsOf,
  signedInAccountOf,
} from '@libs/harness/identity';
import { focusActor } from '@libs/harness/shell-actions';
import { openHarness } from './open-profile-harness';

// regression: same-account-sign-in-keeps-guest-snapshots
test('upgrading a guest in place refreshes its sign-in method snapshot', async () => {
  await using s = await openHarness(
    'same-account-sign-in-keeps-guest-snapshots'
  );
  await s.apply(focusActor, 'alice');
  const guest = await s.read(deviceMemberIdOf, 'alice');
  if (guest === null) throw new Error('The guest has no local account');
  await s.apply(signInWithApple, 'alice', { account: 'icloud' });
  expect(await s.read(signedInAccountOf, 'alice')).toBe(guest);
  await s.until((harness) => localSignInMethodsOf(harness, 'alice', guest), {
    pred: (methods) => methods.join(',') === 'apple',
    maxMs: 20_000,
  });
});
