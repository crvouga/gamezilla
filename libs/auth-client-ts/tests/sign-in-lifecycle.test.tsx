import { afterEach, expect, test } from 'bun:test';
import {
  SESSION_TOKEN_KEY,
  SIGN_IN_PENDING_KEY,
} from '@libs/auth-shared-ts/auth-storage-keys';
import { cleanup } from '@solidjs/testing-library';
import { signInLifecycleFixture } from './sign-in-lifecycle-fixture';

afterEach(cleanup);

// regression: sign-in-callback-hydration-cancelled-before-exchange
test('a hydrated guest during callback exchange stays loading until its account is ready', async () => {
  const fixture = await signInLifecycleFixture();
  fixture.publish({ isHydrated: true, session: null, error: null });
  expect(fixture.lifecycle.phase()).toBe('loading');
  expect(fixture.store.getValue(SIGN_IN_PENDING_KEY)).not.toBeNull();
  fixture.publish({
    isHydrated: true,
    session: {
      externalUserId: 'alice-google',
      accountId: null,
      email: 'alice.559006d7@gmail.com',
      expiresAt: null,
      authenticatedAt: null,
    },
    error: null,
  });
  expect(fixture.lifecycle.phase()).toBe('loading');
  await fixture.store.write(SESSION_TOKEN_KEY, 'ready-alice-session');
  expect(fixture.lifecycle.phase()).toBe('success');
});

test('a resumed callback failure still explains the failure and clears pending', async () => {
  const fixture = await signInLifecycleFixture();
  const error = new Error('Provider declined sign-in');
  fixture.publish({ isHydrated: true, session: null, error });
  expect(fixture.lifecycle.phase()).toBe('error');
  expect(fixture.lifecycle.error()).toBe(error);
  expect(fixture.store.getValue(SIGN_IN_PENDING_KEY)).toBeNull();
});

test('an abandoned callback still reaches its existing bounded recovery state', async () => {
  const fixture = await signInLifecycleFixture();
  fixture.publish({ isHydrated: true, session: null, error: null });
  fixture.time.clock.advance(12_000);
  expect(fixture.lifecycle.phase()).toBe('error');
  expect(fixture.lifecycle.error()?.message).toBe(
    'Sign-in timed out. Please try again.'
  );
  expect(fixture.store.getValue(SIGN_IN_PENDING_KEY)).toBeNull();
});
