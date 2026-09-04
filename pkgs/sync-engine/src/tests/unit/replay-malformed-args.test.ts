import { describe, expect, test } from 'bun:test';
import { applySqliteSchema } from '@pkgs/db-schema/sqlite';
import { sql } from '@pkgs/sql';
import { SqlClientImplSqliteMem } from '@pkgs/sql-client/sqlite/impl-sqlite-mem';

import { migrateLocalSchema } from '../../client/local-schema-migrate';
import { replayMutation } from '../../mutations/server/replay-mutation';
import { syncEngineServerSchema } from '../../shared/schema/tables';
import { acmeLocalSchema, setNote } from '../apps/acme';

async function openReplayDb() {
  const db = SqlClientImplSqliteMem.open();
  await db.connect();
  await applySqliteSchema(db, syncEngineServerSchema, {
    ownership: 'declared-only',
  });
  await migrateLocalSchema(db, acmeLocalSchema);
  return db;
}

describe('replay malformed args unit', () => {
  test.each(['not-json', '{'])(
    'args %j → INVALID_ARGS permanent reject',
    async (args) => {
      const db = await openReplayDb();
      const outcome = await replayMutation(
        {
          serverDb: db,
          registry: { [setNote.name]: setNote },
          auth: {
            actorId: 'a',
            deviceId: 'd',
            accountId: null,
            isAnon: false,
          },
          now: () => Date.parse('2020-01-01T00:00:00.000Z'),
          createId: () => 'rej-1',
        },
        {
          id: 'm1',
          name: 'setNote',
          args,
          clientId: 'c0',
          seq: 1,
          createdAt: '2020-01-01T00:00:00.000Z',
        }
      );
      expect(outcome).toEqual({
        status: 'rejected',
        code: 'INVALID_ARGS',
        message: 'Malformed mutation args.',
      });
      const applied = await db.query(sql<{ status: string }>`
        SELECT status FROM sync_engine_mutations_applied
        WHERE mutation_id = ${'m1'}
          AND deleted_at IS NULL
      `);
      expect(applied[0]?.status).toBe('rejected');
      const notes = await db.query(sql<{ n: number }>`
        SELECT COUNT(*) AS n FROM notes
      `);
      expect(notes[0]?.n).toBe(0);
      await db.disconnect();
    }
  );
});
