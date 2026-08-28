import { describe, expect, test } from 'bun:test';
import type { PubSub } from '@pkgs/pubsub/interface';
import { SqlClientImplSqliteMem } from '@pkgs/sql-client/sqlite/impl-sqlite-mem';

import { createLocalSyncEngine } from '../../client/create-local-sync-engine';
import type { Timers } from '../../client/sim-ports';
import { acmeLocalSchema } from '../apps/acme';

const timers: Timers = {
  setTimeout: () => 0,
  clearTimeout: () => undefined,
  setInterval: () => 0,
  clearInterval: () => undefined,
};

function fakePubSub(): PubSub {
  return {
    publish: async () => undefined,
    subscribe: () => () => undefined,
    status: () => 'down',
    onStatus: () => () => undefined,
    close: () => undefined,
  };
}

async function openEngine(createPubSub: () => PubSub | null) {
  const db = SqlClientImplSqliteMem.open();
  await db.connect();
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
    sessionQueries: [],
    postQueries: async () => [],
    postMutations: async () => ({ ok: true, verdicts: [], ackSeq: 0 }),
    isAuthRevoked: () => false,
    deleteDatabase: async () => undefined,
    now: () => 0,
    timers,
    createId: () => 'id1',
    reconcileIntervalMs: 0,
    push: {
      queryRegistry: {},
      createPubSub,
      getChannelsCtx: () => ({ actorId: 'alice' }),
    },
  });
  return { db, engine };
}

describe('connect survives pubsub unavailable', () => {
  test('createPubSub throw does not fail connect', async () => {
    const { engine, db } = await openEngine(() => {
      throw new Error('pubsub unavailable');
    });
    await engine.connect();
    expect(engine.status.getSnapshot().connection).toBe('syncing');
    await engine.disconnect();
    await db.disconnect();
  });

  test('null createPubSub then ensurePush attaches later', async () => {
    let ready = false;
    let creates = 0;
    const { engine, db } = await openEngine(() => {
      creates += 1;
      if (!ready) return null;
      return fakePubSub();
    });
    await engine.connect();
    expect(engine.status.getSnapshot().connection).toBe('syncing');
    expect(creates).toBe(1);

    ready = true;
    engine.ensurePush();
    await Promise.resolve();
    await Promise.resolve();
    expect(creates).toBeGreaterThan(1);

    await engine.disconnect();
    await db.disconnect();
  });
});
