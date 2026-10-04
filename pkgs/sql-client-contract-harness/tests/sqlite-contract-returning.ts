import { test } from 'bun:test';
import { defineTable } from '@pkgs/db-schema-shared/define-table';
import sql from '@pkgs/sql-shared/sql';
import type { SqliteClientGetter } from './sqlite-contract-helpers';
import { applySchema, expectQuery, setup } from './sqlite-contract-helpers';

export function registerSqliteReturningTests(
  getClient: SqliteClientGetter
): void {
  test('INSERT RETURNING * (IdP createUser shape)', async () => {
    const client = getClient();
    await applySchema(client, [
      defineTable({
        domain: 'sample_auth_user',
        name: 'sample_auth_user',
        columns: {
          name: 'text',
          email: 'text',
          email_verified: 'integer',
        },
      }),
    ]);
    await expectQuery(
      client,
      sql<{
        id: string;
        name: string;
        email: string;
        email_verified: number;
        created_at: string;
        updated_at: string;
        deleted_at: string | null;
      }>`insert into "sample_auth_user" ("name", "email", "email_verified", "created_at", "updated_at", "id") values (${'Ada'}, ${'ada@ex.com'}, ${0}, ${'2026-01-01'}, ${'2026-01-01'}, ${'uid1'}) returning *`,
      [
        {
          id: 'uid1',
          name: 'Ada',
          email: 'ada@ex.com',
          email_verified: 0,
          created_at: '2026-01-01',
          updated_at: '2026-01-01',
          deleted_at: null,
        },
      ]
    );
  });

  test('INSERT RETURNING partial columns', async () => {
    const client = getClient();
    await applySchema(client, [
      defineTable({
        domain: 'sample_auth_user',
        name: 'sample_auth_user',
        columns: { name: 'text', email: 'text' },
      }),
    ]);
    await expectQuery(
      client,
      sql<{ id: string; email: string }>`
        INSERT INTO sample_auth_user (id, name, email)
        VALUES (${'u1'}, ${'Ada'}, ${'a@b.co'})
        RETURNING id, email
      `,
      [{ id: 'u1', email: 'a@b.co' }]
    );
  });

  test('UPDATE RETURNING * (mutation write-capture shape)', async () => {
    const client = getClient();
    await applySchema(client, [
      defineTable({
        domain: 'profile',
        name: 'profile',
        columns: { username: 'text', username_norm: 'text' },
      }),
    ]);
    await setup(client, [
      sql<void>`
        INSERT INTO profile (id, username, username_norm)
        VALUES (${'u1'}, ${'old'}, ${'old'})
      `,
    ]);
    await expectQuery(
      client,
      sql<{
        id: string;
        username: string;
        username_norm: string;
        created_at: string | null;
        updated_at: string | null;
        deleted_at: string | null;
      }>`
        UPDATE profile
        SET username = ${'new_name'}, username_norm = ${'new_name'}
        WHERE id = ${'u1'}
        RETURNING *
      `,
      [
        {
          id: 'u1',
          username: 'new_name',
          username_norm: 'new_name',
          created_at: null,
          updated_at: null,
          deleted_at: null,
        },
      ]
    );
  });

  test('UPDATE RETURNING with predicate on mutated column (endSpace shape)', async () => {
    const client = getClient();
    await applySchema(client, [
      defineTable({
        domain: 'spaces',
        name: 'spaces',
        columns: { ended_at: 'timestamp', host_id: 'text' },
      }),
    ]);
    await setup(client, [
      sql<void>`
        INSERT INTO spaces (id, ended_at, host_id)
        VALUES (${'s1'}, ${null}, ${'d1'})
      `,
    ]);
    const now = '2026-08-16T18:00:00.000Z';
    await expectQuery(
      client,
      sql<{
        id: string;
        ended_at: string | null;
        host_id: string;
        created_at: string | null;
        updated_at: string | null;
        deleted_at: string | null;
      }>`
        UPDATE spaces
        SET ended_at = ${now}, host_id = ${'d1'}
        WHERE id = ${'s1'} AND ended_at IS NULL
        RETURNING *
      `,
      [
        {
          id: 's1',
          ended_at: now,
          host_id: 'd1',
          created_at: null,
          updated_at: null,
          deleted_at: null,
        },
      ]
    );
  });

  test('UPDATE RETURNING soft-delete WHERE deleted_at IS NULL', async () => {
    const client = getClient();
    await applySchema(client, [
      defineTable({
        domain: 'spaces',
        name: 'spaces_open_sessions',
        columns: { space_id: 'text' },
      }),
    ]);
    await setup(client, [
      sql<void>`
        INSERT INTO spaces_open_sessions (id, space_id)
        VALUES (${'sess1'}, ${'s1'})
      `,
    ]);
    const now = '2026-08-16T18:00:00.000Z';
    await expectQuery(
      client,
      sql<{
        id: string;
        space_id: string;
        deleted_at: string | null;
        created_at: string | null;
        updated_at: string | null;
      }>`
        UPDATE spaces_open_sessions
        SET deleted_at = ${now}
        WHERE space_id = ${'s1'} AND deleted_at IS NULL
        RETURNING *
      `,
      [
        {
          id: 'sess1',
          space_id: 's1',
          deleted_at: now,
          created_at: null,
          updated_at: null,
        },
      ]
    );
  });

  test('quotes primary subquery alias', async () => {
    const client = getClient();
    await applySchema(client, [
      defineTable({
        domain: 'sample_auth_user',
        name: 'sample_auth_user',
        columns: { email: 'text' },
      }),
    ]);
    await setup(client, [
      sql<void>`INSERT INTO sample_auth_user (id, email) VALUES (${'u1'}, ${'a@b.co'})`,
    ]);
    await expectQuery(
      client,
      sql<{
        id: string;
        email: string;
        created_at: string | null;
        updated_at: string | null;
        deleted_at: string | null;
      }>`select "primary".* from (select * from "sample_auth_user" where "sample_auth_user"."email" = ${'a@b.co'}) as "primary"`,
      [
        {
          id: 'u1',
          email: 'a@b.co',
          created_at: null,
          updated_at: null,
          deleted_at: null,
        },
      ]
    );
  });
}
