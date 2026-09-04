import { test } from 'bun:test';
import { defineTable } from '@pkgs/db-schema';
import { raw, sql } from '@pkgs/sql';
import {
  applySchema,
  expectQuery,
  type SqliteClientGetter,
  setup,
} from './sqlite-contract-helpers';

export function registerSqliteQueryTests(getClient: SqliteClientGetter): void {
  test('parameterized LIMIT / OFFSET', async () => {
    const client = getClient();
    await applySchema(client, [
      defineTable({
        domain: 'items',
        name: 'items',
        columns: { n: 'integer' },
      }),
    ]);
    await setup(client, [
      sql<void>`INSERT INTO items (id, n) VALUES (${'1'}, ${1})`,
      sql<void>`INSERT INTO items (id, n) VALUES (${'2'}, ${2})`,
      sql<void>`INSERT INTO items (id, n) VALUES (${'3'}, ${3})`,
      sql<void>`INSERT INTO items (id, n) VALUES (${'4'}, ${4})`,
      sql<void>`INSERT INTO items (id, n) VALUES (${'5'}, ${5})`,
    ]);
    await expectQuery(
      client,
      sql<{ n: number }>`
        SELECT n FROM items WHERE n > ${0} ORDER BY n LIMIT ${2} OFFSET ${1}
      `,
      [{ n: 2 }, { n: 3 }]
    );
  });

  test('nested subquery IN (SELECT …)', async () => {
    const client = getClient();
    await applySchema(client, [
      defineTable({
        domain: 'spaces',
        name: 'spaces',
        columns: { host_member_id: 'text' },
      }),
      defineTable({
        domain: 'spaces',
        name: 'spaces_users',
        columns: { space_id: 'text', user_id: 'text' },
      }),
    ]);
    await setup(client, [
      sql<void>`INSERT INTO spaces (id, host_member_id) VALUES (${'s1'}, ${'u'})`,
      sql<void>`INSERT INTO spaces_users (id, space_id, user_id) VALUES (${'su1'}, ${'s1'}, ${'u2'})`,
    ]);
    await expectQuery(
      client,
      sql<{ id: string }>`
        SELECT id FROM spaces_users
        WHERE space_id IN (
          SELECT id FROM spaces WHERE host_member_id = ${'u'}
        )
      `,
      [{ id: 'su1' }]
    );
  });

  test('join + ORDER BY', async () => {
    const client = getClient();
    await applySchema(client, [
      defineTable({
        domain: 'a',
        name: 'a',
        columns: { n: 'integer' },
      }),
      defineTable({
        domain: 'b',
        name: 'b',
        columns: { a_id: 'text', label: 'text' },
      }),
    ]);
    await setup(client, [
      sql<void>`INSERT INTO a (id, n) VALUES (${'a1'}, ${1})`,
      sql<void>`INSERT INTO a (id, n) VALUES (${'a2'}, ${2})`,
      sql<void>`INSERT INTO b (id, a_id, label) VALUES (${'b1'}, ${'a1'}, ${'x'})`,
      sql<void>`INSERT INTO b (id, a_id, label) VALUES (${'b2'}, ${'a2'}, ${'y'})`,
    ]);
    await expectQuery(
      client,
      sql<{ id: string; label: string; n: number }>`
        SELECT b.id, b.label, a.n
          FROM b
          JOIN a ON a.id = b.a_id
         ORDER BY a.n DESC
      `,
      [
        { id: 'b2', label: 'y', n: 2 },
        { id: 'b1', label: 'x', n: 1 },
      ]
    );
  });

  test('COUNT(*) AS count', async () => {
    const client = getClient();
    await applySchema(client, [
      defineTable({
        domain: 'inbox_interactions',
        name: 'inbox_interactions',
        columns: {
          user_id: 'text',
          active: 'integer',
          read_at: 'integer',
          archived_at: 'integer',
          dismissed_at: 'integer',
        },
      }),
    ]);
    await setup(client, [
      sql<void>`INSERT INTO inbox_interactions (id, user_id, active) VALUES (${'1'}, ${'u'}, ${1})`,
    ]);
    await expectQuery(
      client,
      sql<{ count: number }>`
        SELECT COUNT(*) AS count
          FROM inbox_interactions
         WHERE user_id = ${'u'}
           AND active IS TRUE
           AND read_at IS NULL
      `,
      [{ count: 1 }]
    );
  });

  test('schema_ prefix columns + ON CONFLICT', async () => {
    const client = getClient();
    await applySchema(client, [
      defineTable({
        domain: 'inbox_schema_state',
        name: 'inbox_schema_state',
        columns: { schema_fingerprint: 'text' },
      }),
    ]);
    await setup(client, [
      sql<void>`
        INSERT INTO inbox_schema_state (id, schema_fingerprint)
        VALUES (${'1'}, ${'fp-v1'})
        ON CONFLICT (id) DO UPDATE SET schema_fingerprint = EXCLUDED.schema_fingerprint
      `,
    ]);
    await expectQuery(
      client,
      raw<{ schema_fingerprint: string }>(
        `SELECT schema_fingerprint FROM inbox_schema_state WHERE id = '1'`
      ),
      [{ schema_fingerprint: 'fp-v1' }]
    );
  });
}
