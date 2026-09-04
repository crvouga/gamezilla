import { describe, expect, test } from 'bun:test';
import { sql } from '@pkgs/sql';
import { SqlClientImplSqliteMem } from '@pkgs/sql-client/sqlite/impl-sqlite-mem';

import { migrateLocalSchema } from '../../client/local-schema-migrate';
import { applyFullMerge } from '../../client/merge';
import { createTableChangeBus } from '../../queries/client/table-change-bus';
import { acmeLocalSchema, acmeMutationRegistry } from '../apps/acme';

describe('rebase corrupt pending args', () => {
  test('skips JSON.parse failure so merge still applies', async () => {
    const db = SqlClientImplSqliteMem.open();
    await db.connect();
    await migrateLocalSchema(db, acmeLocalSchema);
    await db.run(sql`
      INSERT INTO sync_engine_mutations (
        id, name, args, client_id, seq,
        created_at, updated_at, deleted_at
      )
      VALUES (
        ${'bad'},
        ${'setNote'},
        ${'{not-json'},
        ${'c0'},
        ${1},
        ${'2020-01-01T00:00:00.000Z'},
        ${'2020-01-01T00:00:00.000Z'},
        ${null}
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
    await expect(
      applyFullMerge(deps, {
        scopeHash: 's',
        checkpoint: '1',
        hash: 'h',
        tables: { notes: [] },
      })
    ).resolves.toBe('applied');

    const stillQueued = await db.query(sql<{ id: string }>`
      SELECT id FROM sync_engine_mutations
      WHERE id = ${'bad'}
        AND deleted_at IS NULL
    `);
    expect(stillQueued).toEqual([{ id: 'bad' }]);
  });
});
