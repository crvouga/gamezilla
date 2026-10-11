import { expect, test } from 'bun:test';
import { createOfflineAuthClient } from '@libs/app-root-client/offline-auth-client';
import { createOfflineNetworkController } from '@libs/app-root-client/offline-network-controller';
import {
  peekPendingSignupUsername,
  setPendingSignupUsername,
  takePendingSignupUsername,
} from '@libs/auth-shared/pending-signup-username';
import type { AuthClientPort } from '@pkgs/auth-root-shared/auth-client-port';
import { KvImplInMemory } from '@pkgs/kv-root-shared/impl-in-memory';

// regression: offline-auth-client-loses-signup-username
test('a signup username left with the auth client is taken through its offline wrapper', async () => {
  const controller = createOfflineNetworkController(new KvImplInMemory());
  await controller.ready();
  const inner = { session: {} } as unknown as AuthClientPort;
  const app = createOfflineAuthClient(controller, inner);

  setPendingSignupUsername(inner, 'alice');

  expect(peekPendingSignupUsername(app, 'google-alice')).toBe('alice');
  expect(takePendingSignupUsername(app)).toBe('alice');
  expect(peekPendingSignupUsername(inner, 'google-alice')).toBeNull();
});
