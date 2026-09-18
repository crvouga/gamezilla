import { describe, expect, test } from 'bun:test';
import { raw } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { defineTable } from '../core/define-table';
import { registerTables } from '../core/register-tables';
import type { Schema } from '../core/types';

/** One dialect the shared contract matrix runs against. */
export type DbSchemaContractFactory = {
  readonly name: string;
  readonly dialect: 'postgres' | 'sqlite';
  open(): Promise<{
    client: SqlClient;
    reconcile: (schema: Schema) => Promise<void>;
    close: () => Promise<void>;
  }>;
};

/**
 * Shared contract suite for both dialects. Call from a `describe` block so a
 * behaviour is pinned once and asserted on Postgres and SQLite.
 */
export function runDbSchemaContractTests(
  factory: DbSchemaContractFactory
): void {
  describe(`db-schema contract (${factory.name})`, () => {
    registerBasicReconcileTests(factory);
    registerTolerantClientTests(factory);
    registerRetiredColumnTests(factory);
    registerRenameBackfillTests(factory);
    registerTypeAndOwnershipTests(factory);
  });
}

async function sqliteTableCount(
  client: SqlClient,
  name: string
): Promise<number> {
  const rows = await client.query<{ n: number }>(
    raw<{ n: number }>(
      `SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table' AND name='${name}'`
    )
  );
  return Number(rows[0]?.n);
}

async function postgresTableCount(
  client: SqlClient,
  name: string
): Promise<number> {
  const rows = await client.query<{ n: number }>(
    raw<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM information_schema.tables WHERE table_name='${name}'`
    )
  );
  return Number(rows[0]?.n);
}

function registerBasicReconcileTests(factory: DbSchemaContractFactory): void {
  test('idempotent reconcile', async () => {
    const { client, reconcile, close } = await factory.open();
    try {
      const schema = registerTables([
        defineTable({
          domain: 'notes',
          name: 'notes',
          columns: { body: 'text' },
          indexes: ['body'],
        }),
      ]);
      await reconcile(schema);
      await reconcile(schema);
      const count =
        factory.dialect === 'sqlite'
          ? await sqliteTableCount(client, 'notes')
          : await postgresTableCount(client, 'notes');
      expect(count).toBe(1);
    } finally {
      await close();
    }
  });

  test('additive create table + column', async () => {
    const { client, reconcile, close } = await factory.open();
    try {
      const v1 = registerTables([
        defineTable({
          domain: 'notes',
          name: 'notes',
          columns: { body: 'text' },
        }),
      ]);
      await reconcile(v1);
      const v2 = registerTables([
        defineTable({
          domain: 'notes',
          name: 'notes',
          columns: { body: 'text', title: 'text' },
        }),
      ]);
      await reconcile(v2);
      await client.run(
        raw(`INSERT INTO notes (id, body, title) VALUES ('1', 'hi', 't')`)
      );
      const rows = await client.query<{ title: string }>(
        raw<{ title: string }>(`SELECT title FROM notes WHERE id = '1'`)
      );
      expect(rows[0]?.title).toBe('t');
    } finally {
      await close();
    }
  });
}

function registerTolerantClientTests(factory: DbSchemaContractFactory): void {
  test('undeclared column: postgres refuses, sqlite preserves', async () => {
    const { client, reconcile, close } = await factory.open();
    try {
      const v1 = registerTables([
        defineTable({
          domain: 'notes',
          name: 'notes',
          columns: { body: 'text', local_only: 'text' },
        }),
      ]);
      await reconcile(v1);
      await client.run(
        raw(
          `INSERT INTO notes (id, body, local_only) VALUES ('1', 'hi', 'kept')`
        )
      );
      const v2 = registerTables([
        defineTable({
          domain: 'notes',
          name: 'notes',
          columns: { body: 'text' },
        }),
      ]);
      if (factory.dialect === 'postgres') {
        await expect(reconcile(v2)).rejects.toThrow(
          /retiredColumns|not declared/i
        );
        return;
      }
      await reconcile(v2);
      const rows = await client.query<{ local_only: string }>(
        raw<{ local_only: string }>(
          `SELECT local_only FROM notes WHERE id = '1'`
        )
      );
      expect(rows[0]?.local_only).toBe('kept');
    } finally {
      await close();
    }
  });
}

function registerRetiredColumnTests(factory: DbSchemaContractFactory): void {
  test('retired column: postgres keeps it, sqlite drops it on rebuild', async () => {
    const { client, reconcile, close } = await factory.open();
    try {
      const v1 = registerTables([
        defineTable({
          domain: 'notes',
          name: 'notes',
          columns: { body: 'text', old_field: 'text' },
        }),
      ]);
      await reconcile(v1);
      await client.run(
        raw(
          `INSERT INTO notes (id, body, old_field) VALUES ('1', 'hi', 'gone')`
        )
      );
      const v2 = registerTables([
        defineTable({
          domain: 'notes',
          name: 'notes',
          columns: { body: 'text' },
          retiredColumns: [{ name: 'old_field', type: 'text', note: 'unused' }],
        }),
      ]);
      await reconcile(v2);
      if (factory.dialect === 'postgres') {
        const rows = await client.query<{ old_field: string }>(
          raw<{ old_field: string }>(
            `SELECT old_field FROM notes WHERE id = '1'`
          )
        );
        expect(rows[0]?.old_field).toBe('gone');
        return;
      }
      const rows = await client.query<{ body: string }>(
        raw<{ body: string }>(`SELECT body FROM notes WHERE id = '1'`)
      );
      expect(rows[0]?.body).toBe('hi');
      let readThrew = false;
      try {
        await client.query(
          raw<{ x: string }>(`SELECT old_field AS x FROM notes`)
        );
      } catch {
        readThrew = true;
      }
      expect(readThrew).toBe(true);
    } finally {
      await close();
    }
  });

  test('retired column with the wrong frozen type is drift', async () => {
    const { reconcile, close } = await factory.open();
    try {
      const v1 = registerTables([
        defineTable({
          domain: 'notes',
          name: 'notes',
          columns: { body: 'text', old_field: 'text' },
        }),
      ]);
      await reconcile(v1);
      const v2 = registerTables([
        defineTable({
          domain: 'notes',
          name: 'notes',
          columns: { body: 'text' },
          retiredColumns: [
            { name: 'old_field', type: 'integer', note: 'wrong type' },
          ],
        }),
      ]);
      await expect(reconcile(v2)).rejects.toThrow(
        /retired column changed shape/i
      );
    } finally {
      await close();
    }
  });
}

function registerRenameBackfillTests(factory: DbSchemaContractFactory): void {
  test('renamedFrom preserves values via backfill', async () => {
    const { client, reconcile, close } = await factory.open();
    try {
      const v1 = registerTables([
        defineTable({
          domain: 'notes',
          name: 'notes',
          columns: { name: 'text' },
        }),
      ]);
      await reconcile(v1);
      await client.run(
        raw(`INSERT INTO notes (id, name) VALUES ('1', 'alice')`)
      );
      const v2 = registerTables([
        defineTable({
          domain: 'notes',
          name: 'notes',
          columns: {
            display_name: { type: 'text', renamedFrom: 'name' },
          },
          retiredColumns: [
            { name: 'name', type: 'text', note: 'renamed to display_name' },
          ],
        }),
      ]);
      await reconcile(v2);
      const rows = await client.query<{ display_name: string }>(
        raw<{ display_name: string }>(
          `SELECT display_name FROM notes WHERE id = '1'`
        )
      );
      expect(rows[0]?.display_name).toBe('alice');
    } finally {
      await close();
    }
  });

  test('backfill fills only NULLs and is rerun-safe', async () => {
    const { client, reconcile, close } = await factory.open();
    try {
      const v1 = registerTables([
        defineTable({
          domain: 'notes',
          name: 'notes',
          columns: { first_name: 'text' },
        }),
      ]);
      await reconcile(v1);
      await client.run(
        raw(`INSERT INTO notes (id, first_name) VALUES ('1', 'bob')`)
      );
      const v2 = registerTables([
        defineTable({
          domain: 'notes',
          name: 'notes',
          columns: {
            first_name: 'text',
            label: { type: 'text', backfill: { sql: `first_name` } },
          },
        }),
      ]);
      await reconcile(v2);
      await reconcile(v2);
      const rows = await client.query<{ label: string }>(
        raw<{ label: string }>(`SELECT label FROM notes WHERE id = '1'`)
      );
      expect(rows[0]?.label).toBe('bob');
    } finally {
      await close();
    }
  });
}

function registerTypeAndOwnershipTests(factory: DbSchemaContractFactory): void {
  test('forbidden in-place type change fails', async () => {
    const { reconcile, close } = await factory.open();
    try {
      const v1 = registerTables([
        defineTable({
          domain: 'notes',
          name: 'notes',
          columns: { n: 'text' },
        }),
      ]);
      await reconcile(v1);
      const bad = registerTables([
        defineTable({
          domain: 'notes',
          name: 'notes',
          columns: { n: 'integer' },
        }),
      ]);
      await expect(reconcile(bad)).rejects.toThrow(/type mismatch/i);
    } finally {
      await close();
    }
  });
}
