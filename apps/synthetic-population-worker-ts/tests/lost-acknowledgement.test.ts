import { expect, test } from 'bun:test';
import type { ManagedSession } from '@apps/synthetic-population-worker-ts/managed-session';
import { runtimeBackend } from './runtime-backend';
import {
  awaitRuntimeUsers,
  runtimeHeartbeat,
  runtimeSession,
} from './runtime-session';

test('a lost move acknowledgement retries the ordinary upload with one effective game action', async () => {
  // regression: synthetic-realms-miss-peer-invalidation
  // regression: synthetic-native-realms-incompatible-game-pools
  const backend = await runtimeBackend(2);
  const sessions: ManagedSession[] = [];
  try {
    const workerId = backend.wall.createId();
    await runtimeHeartbeat(backend, workerId, 'lost-acknowledgement');
    backend.acknowledgement.arm();
    await Promise.all(
      [0, 1].map(async () => {
        const realm = await runtimeSession(
          backend,
          workerId,
          'lost-acknowledgement'
        );
        sessions.push(realm.session);
        await realm.authenticated;
      })
    );
    await awaitRuntimeUsers(
      backend,
      (users) => users.length === 2 && backend.acknowledgement.attempts() >= 2
    );
    const accepted = backend.acknowledgement.accepted();
    expect(accepted).not.toBeNull();
    const args = JSON.parse(accepted!.args) as { requestId: string };
    expect(Number((await backend.moveEffects(args.requestId))[0]?.count)).toBe(
      1
    );
    const users = await backend.repository.users();
    expect(new Set(users.map((user) => user.account_id)).size).toBe(2);
    expect(users.every((user) => user.generation === 1)).toBe(true);
  } finally {
    for (const session of sessions) session.abort();
    await backend.close();
  }
}, 60_000);
