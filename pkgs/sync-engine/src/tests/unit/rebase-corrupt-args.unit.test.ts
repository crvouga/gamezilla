import { describe, expect, test } from 'bun:test';
import { assert, ThrowingCrashHandler } from '@pkgs/assert';
import { sql } from '@pkgs/sql';
import { SqlClientImplSqliteMem } from '@pkgs/sql-client/sqlite/impl-sqlite-mem';

import { migrateLocalSchema } from '../../client/local-schema-migrate';
import { applyFullMerge } from '../../client/merge';
import { createTableChangeBus } from '../../queries/client/table-change-bus';
import { acmeLocalSchema, acmeMutationRegistry } from '../apps/acme';

describe('rebase corrupt pending args', () => {
  test('crashes on JSON.parse failure in pending queue', async () => {
    const db = SqlClientImplSqliteMem.open();
    await db.connect();
    await migrateLocalSchema(db, acmeLocalSchema);
    await db.run(sql`
      INSERT INTO sync_engine_mutations (
        id, name, args, client_id, seq, created_at
      )
      VALUES (
        ${'bad'},
        ${'setNote'},
        ${'{not-json'},
        ${'c0'},
        ${1},
        ${'2020-01-01T00:00:00.000Z'}
      )
    `);
    const deps = {
      db,
      registry: acmeMutationRegistry,
      env: {
        actorId: 'a',
        deviceId: 'd',
        accountId: 'acct',
        isAnon: false,
        now: () => new Date('2020-01-01T00:00:00.000Z'),
        createId: () => 'id',
      },
      bus: createTableChangeBus(),
      clientId: 'c0',
    };
    const dispose = assert.registerCrashHandler(new ThrowingCrashHandler());
    try {
      await expect(
        applyFullMerge(deps, {
          scopeHash: 's',
          checkpoint: '1',
          hash: 'h',
          tables: { notes: [] },
        })
      ).rejects.toThrow(/corrupt pending mutation args/i);
    } finally {
      dispose();
    }
  });
});
