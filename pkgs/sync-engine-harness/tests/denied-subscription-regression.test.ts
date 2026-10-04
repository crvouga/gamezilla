import { Database } from 'bun:sqlite';
import { expect, test } from 'bun:test';
import { createHarnessClock } from '@pkgs/clock-shared/harness-clock';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client-sqlite-root-server/impl-bun-sqlite';
import sql from '@pkgs/sql-root-shared/sql';
import { createLocalSyncEngine } from '@pkgs/sync-engine-client/create-local-sync-engine';
import { exampleLocalSchema } from '@pkgs/sync-engine-harness/local-schema';

// regression: sync-denied-subscription-never-recovers
test('a held lookup denied before sign-in reauthorizes on reconnect without polling', async () => {
  const raw = new Database(':memory:');
  const db = new SqlClientImplBunSqlite(raw);
  const time = createHarnessClock();
  let allowed = false;
  const engine = await createLocalSyncEngine({
    db,
    localSchema: exampleLocalSchema,
    mutationRegistry: {},
    getMutationEnv: () => ({
      actorId: 'alice',
      deviceId: 'phone',
      accountId: 'alice',
      isAnon: false,
      now: () => new Date(time.clock.now()),
      createId: () => 'id',
    }),
    getClientId: () => 'phone',
    sessionQueries: [{ name: 'notes', params: {} }],
    postQueries: async (requests) =>
      requests.map(() =>
        allowed
          ? {
              status: 'ok' as const,
              checkpoint: '2',
              hash: 'accepted-note',
              tables: {
                notes: [
                  {
                    id: 'note-1',
                    owner_id: 'alice',
                    title: 'Recovered',
                    body: '',
                    folder_id: null,
                    space_id: null,
                    created_at: new Date(0).toISOString(),
                    updated_at: new Date(0).toISOString(),
                    deleted_at: null,
                  },
                ],
              },
            }
          : { status: 'denied' as const }
      ),
    postMutations: async () => ({
      ok: true,
      serverTimeMs: 0,
      verdicts: [],
      ackSeq: 0,
    }),
    isAuthRevoked: () => false,
    deleteDatabase: async () => undefined,
    now: time.clock.now,
    timers: time.timers,
    createId: () => 'id',
    reconcileIntervalMs: 0,
    enableMutationUpload: false,
  });
  try {
    await engine.connect();
    await engine.refreshQueries();
    await engine.waitForFirstSync();
    expect(await db.query(sql<{ id: string }>`SELECT id FROM notes`)).toEqual(
      []
    );
    allowed = true;
    await engine.connect();
    await engine.refreshQueries();
    expect(
      await db.query(
        sql<{ id: string; title: string }>`SELECT id, title FROM notes`
      )
    ).toEqual([{ id: 'note-1', title: 'Recovered' }]);
  } finally {
    await engine.disconnect();
    raw.close();
  }
});
