import { expect, test } from 'bun:test';
import { createOfflineAuthClient } from '@libs/app-root-client-ts/offline-auth-client';
import { createOfflineNetworkController } from '@libs/app-root-client-ts/offline-network-controller';
import {
  peekPendingSignupUsername,
  setPendingSignupUsername,
  takePendingSignupUsername,
} from '@libs/auth-shared-ts/pending-signup-username';
import type { AuthClientPort } from '@pkgs/auth-root-shared-ts/auth-client-port';
import { KvImplInMemory } from '@pkgs/kv-root-shared-ts/impl-in-memory';

// regression: offline-auth-client-loses-signup-username
test('a signup username left with the auth client is taken through its offline wrapper', async () => {
  const controller = createOfflineNetworkController(new KvImplInMemory());
  await controller.ready();
  const inner = { session: {} } as unknown as AuthClientPort;
  const app = createOfflineAuthClient(
    controller,
    inner,
    () => true,
    () => Promise.resolve()
  );

  setPendingSignupUsername(inner, 'alice');

  expect(peekPendingSignupUsername(app, 'google-alice')).toBe('alice');
  expect(takePendingSignupUsername(app)).toBe('alice');
  expect(peekPendingSignupUsername(inner, 'google-alice')).toBeNull();
});

// regression: sso-callback-drops-code-before-first-health-probe
test('the sign-in callback waits for the server before it exchanges its one-time code', async () => {
  const controller = createOfflineNetworkController(new KvImplInMemory());
  await controller.ready();
  const calls: string[] = [];
  const inner = {
    session: {},
    completeHostedAuthRedirect: () => {
      calls.push('exchange');
      return Promise.resolve();
    },
  } as unknown as AuthClientPort;
  const server = Promise.withResolvers<void>();
  let reachable = false;
  const app = createOfflineAuthClient(
    controller,
    inner,
    () => reachable,
    () => server.promise
  );

  const completed = app.completeHostedAuthRedirect!();
  await Promise.resolve();
  expect(calls).toEqual([]);

  reachable = true;
  server.resolve();
  await completed;
  expect(calls).toEqual(['exchange']);
});

// regression: sso-callback-drops-code-before-first-health-probe
test('the sign-in callback still tries its code when the server never answers', async () => {
  const controller = createOfflineNetworkController(new KvImplInMemory());
  await controller.ready();
  let exchanged = false;
  const inner = {
    session: {},
    completeHostedAuthRedirect: () => {
      exchanged = true;
      return Promise.reject(new Error('The service did not answer in time.'));
    },
  } as unknown as AuthClientPort;
  const app = createOfflineAuthClient(
    controller,
    inner,
    () => false,
    () => Promise.reject(new Error('gave up waiting'))
  );

  await expect(app.completeHostedAuthRedirect!()).rejects.toThrow(
    'did not answer'
  );
  expect(exchanged).toBe(true);
});
