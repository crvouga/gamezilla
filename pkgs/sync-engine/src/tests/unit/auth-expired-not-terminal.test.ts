import { describe, expect, test } from 'bun:test';
import { SqlClientImplSqliteMem } from '@pkgs/sql-client/sqlite/impl-sqlite-mem';

import { createLocalSyncEngine } from '../../client/create-local-sync-engine';
import type { Timers } from '../../client/sim-ports';
import { SyncApiAuthError } from '../../client/sync-http-client';
import { acmeLocalSchema } from '../apps/acme';
import { notesWorldQuery } from '../apps/acme/shared/queries';

function createTestTimers(): {
  readonly timers: Timers;
  readonly flushTimers: () => Promise<void>;
} {
  const pending: Array<() => void> = [];
  return {
    timers: {
      setTimeout: (fn) => {
        pending.push(fn);
        return pending.length;
      },
      clearTimeout: () => undefined,
      setInterval: () => 0,
      clearInterval: () => undefined,
    },
    flushTimers: async () => {
      const batch = pending.splice(0);
      for (const fn of batch) fn();
      // Allow async sweep / onError / revoke to settle.
      for (let i = 0; i < 30; i += 1) {
        await Promise.resolve();
      }
    },
  };
}

async function openEngine(args: {
  readonly postQueries: () => Promise<never> | Promise<readonly []>;
  readonly isAuthRevoked?: (error: unknown) => boolean;
  readonly deleteDatabase?: () => Promise<void>;
}) {
  const { timers, flushTimers } = createTestTimers();
  const db = SqlClientImplSqliteMem.open();
  await db.connect();
  let postCalls = 0;
  const engine = await createLocalSyncEngine({
    db,
    localSchema: acmeLocalSchema,
    mutationRegistry: {},
    getMutationEnv: () => ({
      actorId: 'alice',
      deviceId: 'd1',
      accountId: 'alice',
      isAnon: false,
      now: () => new Date(0),
      createId: () => 'id1',
    }),
    getClientId: () => 'd1',
    sessionQueries: [{ name: 'notesWorld', params: {} }],
    postQueries: async () => {
      postCalls += 1;
      return args.postQueries();
    },
    postMutations: async () => ({ ok: true, verdicts: [], ackSeq: 0 }),
    isAuthRevoked:
      args.isAuthRevoked ??
      ((error) =>
        error instanceof SyncApiAuthError && error.reason === 'revoked'),
    deleteDatabase: args.deleteDatabase ?? (async () => undefined),
    now: () => 0,
    timers,
    createId: () => 'id1',
    reconcileIntervalMs: 0,
    enableMutationUpload: false,
    push: {
      queryRegistry: { notesWorld: notesWorldQuery },
      createPubSub: () => null,
      getChannelsCtx: () => ({ actorId: 'alice' }),
    },
  });
  return { db, engine, flushTimers, getPostCalls: () => postCalls };
}

describe('auth expired is non-terminal', () => {
  test('SyncApiAuthError expired does not set lastError or offline', async () => {
    const { engine, db, flushTimers, getPostCalls } = await openEngine({
      postQueries: async () => {
        throw new SyncApiAuthError('expired');
      },
    });
    await engine.connect();
    await flushTimers();
    expect(getPostCalls()).toBeGreaterThan(0);
    const status = engine.status.getSnapshot();
    expect(status.lastError).toBeNull();
    expect(status.online).toBe(true);
    await engine.disconnect();
    await db.disconnect();
  });

  test('generic Error still sets lastError and offline', async () => {
    const { engine, db, flushTimers, getPostCalls } = await openEngine({
      postQueries: async () => {
        throw new Error('boom');
      },
    });
    await engine.connect();
    await flushTimers();
    expect(getPostCalls()).toBeGreaterThan(0);
    const status = engine.status.getSnapshot();
    expect(status.lastError).toBe('boom');
    expect(status.online).toBe(false);
    await engine.disconnect();
    await db.disconnect();
  });

  test('SyncApiAuthError revoked still wipes via isAuthRevoked', async () => {
    let wiped = 0;
    const { engine, flushTimers, getPostCalls } = await openEngine({
      postQueries: async () => {
        throw new SyncApiAuthError('revoked');
      },
      deleteDatabase: async () => {
        wiped += 1;
      },
    });
    await engine.connect();
    await flushTimers();
    expect(getPostCalls()).toBeGreaterThan(0);
    expect(wiped).toBe(1);
  });

  test('upgrade_required remains a sticky lastError', async () => {
    const { engine, db, flushTimers, getPostCalls } = await openEngine({
      postQueries: async () => {
        throw new SyncApiAuthError('upgrade_required');
      },
    });
    await engine.connect();
    await flushTimers();
    expect(getPostCalls()).toBeGreaterThan(0);
    const status = engine.status.getSnapshot();
    expect(status.lastError).toBe('auth:upgrade_required');
    expect(status.online).toBe(false);
    await engine.disconnect();
    await db.disconnect();
  });
});
