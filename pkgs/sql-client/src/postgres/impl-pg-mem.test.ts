// @io-wall-ok
import { describe, expect, test } from 'bun:test';
import { sql } from '@pkgs/sql';
import { createPgMemSqlClient } from './impl-pg-mem';

describe('createPgMemSqlClient', () => {
  test('parameterized query + gen_random_uuid default', async () => {
    const { sqlClient } = createPgMemSqlClient();
    try {
      await sqlClient.connect();
      await sqlClient.run(sql`
        CREATE TABLE items (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          name text NOT NULL
        )
      `);
      await sqlClient.run(sql`INSERT INTO items (name) VALUES (${'alpha'})`);
      const rows = await sqlClient.query<{ id: string; name: string }>(sql`
        SELECT id, name FROM items WHERE name = ${'alpha'}
      `);
      expect(rows).toHaveLength(1);
      expect(rows[0]?.name).toBe('alpha');
      expect(rows[0]?.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
    } finally {
      await sqlClient.disconnect();
    }
  });

  test('transaction rolls back on error via backup/restore', async () => {
    const { sqlClient } = createPgMemSqlClient();
    try {
      await sqlClient.connect();
      await sqlClient.run(sql`CREATE TABLE kv (k text PRIMARY KEY, v int)`);
      await sqlClient.run(sql`INSERT INTO kv (k, v) VALUES (${'a'}, ${1})`);
      await expect(
        sqlClient.transaction(async (tx) => {
          await tx.run(sql`INSERT INTO kv (k, v) VALUES (${'b'}, ${2})`);
          throw new Error('force rollback');
        })
      ).rejects.toThrow('force rollback');
      const rows = await sqlClient.query<{ k: string }>(sql`
        SELECT k FROM kv ORDER BY k
      `);
      expect(rows.map((r) => r.k)).toEqual(['a']);
    } finally {
      await sqlClient.disconnect();
    }
  });

  test('transaction commits on success', async () => {
    const { sqlClient } = createPgMemSqlClient();
    try {
      await sqlClient.connect();
      await sqlClient.run(sql`CREATE TABLE kv (k text PRIMARY KEY, v int)`);
      await sqlClient.transaction(async (tx) => {
        await tx.run(sql`INSERT INTO kv (k, v) VALUES (${'a'}, ${1})`);
        await tx.run(sql`INSERT INTO kv (k, v) VALUES (${'b'}, ${2})`);
      });
      const rows = await sqlClient.query<{ k: string }>(sql`
        SELECT k FROM kv ORDER BY k
      `);
      expect(rows.map((r) => r.k)).toEqual(['a', 'b']);
    } finally {
      await sqlClient.disconnect();
    }
  });
});
