import { expect, test } from 'bun:test';
import type { ManagedSession } from '@apps/synthetic-population-worker/managed-session';
import type { SessionOutput } from '@apps/synthetic-population-worker/session-messages';
import { runtimeBackend } from './runtime-backend';
import {
  awaitRuntimeUsers,
  runtimeHeartbeat,
  runtimeSession,
} from './runtime-session';

const phases = [
  {
    name: 'authentication',
    event: 'UiDriverAction',
    action: 'status-current-user',
  },
  { name: 'browsing', event: 'Authenticated', action: '' },
  { name: 'hosting', event: 'CreatedSpace', action: '' },
  { name: 'matchmaking', event: 'EnteredMatchmaking', action: '' },
] as const;

test.each([...phases])(
  'a disposable worker recovers an interruption during $name',
  async (phase) => {
    // regression: account-cache-crosses-databases
    const backend = await runtimeBackend(1);
    const sessions: ManagedSession[] = [];
    try {
      const oldWorker = backend.wall.createId();
      await runtimeHeartbeat(backend, oldWorker, 'old-version');
      const first = await runtimeSession(backend, oldWorker, 'old-version');
      sessions.push(first.session);
      void first.authenticated.catch(() => undefined);
      let interrupted = false;
      const stopObserving = first.realm.subscribe((raw) => {
        const message = raw as SessionOutput;
        if (
          interrupted ||
          message.type !== 'event' ||
          message.event.name !== phase.event ||
          !(message.event.action ?? '').includes(phase.action)
        )
          return;
        interrupted = true;
        first.session.abort();
      });
      try {
        await awaitRuntimeUsers(backend, () => interrupted, 45_000);
      } finally {
        stopObserving();
      }
      backend.advanceServerTime(first.assignment.config.leaseMs + 1);
      const nextWorker = backend.wall.createId();
      await runtimeHeartbeat(backend, nextWorker, 'new-version');
      const second = await runtimeSession(backend, nextWorker, 'new-version');
      sessions.push(second.session);
      await second.authenticated;
      const recovered = await awaitRuntimeUsers(
        backend,
        (users) =>
          users.length === 1 &&
          users[0]!.account_id !== null &&
          users[0]!.application_version === 'new-version' &&
          users[0]!.last_error === null &&
          users[0]!.activity !== 'recovering'
      );
      expect(recovered[0]!.id).toBe(first.assignment.lease.userId);
      expect(recovered[0]!.worker_id).toBe(nextWorker);
      expect(recovered[0]!.generation).toBe(2);
      expect(second.assignment.email).toBe(first.assignment.email);
    } finally {
      for (const session of sessions) session.abort();
      await backend.close();
    }
  },
  90_000
);
