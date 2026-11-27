import { expect, test } from 'bun:test';
import { reconcileSqliteSchema } from '@pkgs/db-schema-sqlite-shared-ts/reconcile-sqlite-schema';
import { createFaultInjectingSqlClient } from '@pkgs/sql-client-root-shared-ts/fault-injecting-sql-client';
import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client-sqlite-root-server-ts/impl-bun-sqlite';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { awaitMutationVerdict } from '@pkgs/sync-engine-client-ts/await-mutation-verdict';
import { createMutationClient } from '@pkgs/sync-engine-client-ts/create-mutation-client';
import { ensureFrameworkSchema } from '@pkgs/sync-engine-client-ts/local-schema';
import { mutationVerdict } from '@pkgs/sync-engine-client-ts/mutation-status';
import { storeRejection } from '@pkgs/sync-engine-client-ts/mutation-upload-queue';
import { createSharedWatchRegistry } from '@pkgs/sync-engine-client-ts/shared-watch-registry';
import { createSqlWatch } from '@pkgs/sync-engine-client-ts/sql-watch';
import { createTableChangeBus } from '@pkgs/sync-engine-client-ts/table-change-bus';
import { pendingNote } from '@pkgs/sync-engine-harness-ts/mutations';
import { exampleAppSchema } from '@pkgs/sync-engine-harness-ts/schema';
import { createHarnessIds } from '@pkgs/uuid-shared-ts/seeded-create-id';

const at = '2026-11-26T22:01:40.871Z';
const refusal = {
  code: 'CHESS_ILLEGAL_MOVE',
  message: 'This move is not allowed.',
};

async function retire(db: SqlClient, mutationId: string) {
  await db.transaction(async (tx) => {
    await storeRejection(
      tx,
      'device',
      { status: 'rejected', mutationId, ...refusal },
      at
    );
    await tx.run(
      sql`UPDATE sync_engine_mutations SET deleted_at = ${at} WHERE id = ${mutationId}`
    );
  });
}

// regression: refused-command-observed-as-confirmed
test('a refusal committed during a verdict read never turns the refused move into a success', async () => {
  const db = SqlClientImplBunSqlite.openMemory();
  await ensureFrameworkSchema(db);
  try {
    for (const cutoff of [0, 1, 2]) {
      const id = `move-alice-0-7-${String(cutoff)}`;
      await db.run(sql`INSERT INTO sync_engine_mutations (id, name, args, seq)
        VALUES (${id}, ${'playMultiplayerMove'}, ${'{"uci":"7"}'}, ${1})`);
      let reads = 0;
      const during: Pick<SqlClient, 'query'> = {
        query: async (query) => {
          if (reads++ === cutoff) await retire(db, id);
          return db.query(query);
        },
      };
      const seen = await mutationVerdict(during, id);
      expect(['pending', 'rejected']).toContain(seen.status);
      if (seen.status === 'pending' && reads <= cutoff) await retire(db, id);
      expect(await mutationVerdict(db, id)).toEqual({
        status: 'rejected',
        ...refusal,
      });
    }
  } finally {
    await db.disconnect();
  }
});

// regression: refused-command-waits-for-unrelated-reads
test('the refusal of a command with no device writes is available while unrelated reads are held', async () => {
  const db = SqlClientImplBunSqlite.openMemory();
  await ensureFrameworkSchema(db);
  await reconcileSqliteSchema(db, exampleAppSchema, {
    ownership: 'declared-only',
  });
  const { createId } = createHarnessIds('refused-command');
  const command = {
    ...pendingNote,
    name: 'serverDecision',
    run: async () => {},
  };
  const client = createMutationClient({
    db,
    createId,
    registry: { pendingNote, serverDecision: command },
    ids: { clientId: 'device' },
    connectivity: { isOnline: () => true },
    env: {
      actorId: 'alice',
      accountId: 'alice',
      deviceId: 'device',
      isAnon: false,
      createId,
      now: () => new Date(at),
    },
  });
  const bus = createTableChangeBus();
  const { watch } = createSharedWatchRegistry((query) =>
    createSqlWatch({ db, query, bus })
  );
  try {
    for (const { mutation, legacy } of [
      { mutation: command, legacy: false },
      { mutation: pendingNote, legacy: false },
      { mutation: command, legacy: true },
    ]) {
      const saved = await client.mutate(mutation, {
        id: 'move-alice-0-k1',
        body: 'refused',
      });
      if (!saved.ok) throw new Error('expected a queued command');
      if (legacy)
        await db.run(
          sql`UPDATE sync_engine_mutations SET optimistic_writes = NULL WHERE id = ${saved.mutationId}`
        );
      await retire(db, saved.mutationId);
      const repair = Promise.withResolvers<void>();
      const started = Promise.withResolvers<'repair'>();
      const verdict = awaitMutationVerdict(
        {
          db,
          watch,
          refreshQueries: () => {
            started.resolve('repair');
            return repair.promise;
          },
        },
        saved.mutationId
      );
      try {
        const first = await Promise.race([verdict, started.promise]);
        expect(first).toEqual(
          mutation === command && !legacy
            ? { status: 'rejected', ...refusal }
            : 'repair'
        );
      } finally {
        repair.resolve();
        await verdict;
      }
    }
  } finally {
    await db.disconnect();
  }
});

// regression: recorded-abort-refusal-waits-for-second-read
test('the waiting abort receives the refusal already read from SQLite', async () => {
  const id = '01a21b8f-b21b-7fd6-baa0-0df95f563bd5';
  const code = 'CHESS_ABORT_TOO_LATE';
  const retiredAt = '2026-11-27T05:52:13.086Z';
  const message = 'The multiplayer game can no longer be aborted.';
  const raw = SqlClientImplBunSqlite.openMemory();
  const { client: db, failNextCallWith } = createFaultInjectingSqlClient(raw);
  const bus = createTableChangeBus();
  const hydrated = Promise.withResolvers<void>();
  let committed = false;
  const { watch } = createSharedWatchRegistry((query) =>
    createSqlWatch({
      db,
      bus,
      query,
      scheduleNotify(notify) {
        // SQLite has supplied the watched rows. A later database call is unavailable.
        if (committed)
          failNextCallWith(new Error('another database read was required'));
        notify();
        hydrated.resolve();
      },
    })
  );
  try {
    await ensureFrameworkSchema(db);
    await db.run(sql`INSERT INTO sync_engine_mutations (id, name, seq, args, optimistic_writes, created_at)
      VALUES (${id}, 'abortMultiplayer', 1, '{"requestId":"request-1"}', 0, '2026-11-27T05:52:11.880Z')`);
    const verdict = awaitMutationVerdict(
      { db, watch, refreshQueries: async () => {} },
      id
    );
    await hydrated.promise;
    await db.transaction(async (tx) => {
      await storeRejection(
        tx,
        'device',
        { mutationId: id, status: 'rejected', code, message },
        retiredAt
      );
      await tx.run(
        sql`UPDATE sync_engine_mutations SET deleted_at = ${retiredAt} WHERE id = ${id}`
      );
    });
    committed = true;
    bus.emit(['sync_engine_write_rejections', 'sync_engine_mutations']);
    expect(await verdict).toEqual({ status: 'rejected', code, message });
  } finally {
    await raw.disconnect();
  }
});
