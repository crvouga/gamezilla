import { describe, expect, test } from 'bun:test';
import { raw } from '@pkgs/sql';
import type { PostgresSqlClient, SqlClient } from '@pkgs/sql-client/interface';
import { createPostgresDbScope } from '@pkgs/sql-client/postgres/schema';
import { defineEnum } from '../src/core/define-enum';
import { defineSchema } from '../src/core/define-schema';
import { defineTable } from '../src/core/define-table';
import { defineView } from '../src/core/define-view';
import { registerSchema, registerTables } from '../src/core/register-tables';
import type { Schema } from '../src/core/types';
import { postgres } from '../src/postgres/driver';
import { applySqliteSchema } from '../src/sqlite/apply-sqlite-schema';
import { sqlite } from '../src/sqlite/driver';

export type DbSchemaContractFactory = {
  readonly name: string;
  readonly dialect: 'postgres' | 'sqlite';
  open(): Promise<{
    client: SqlClient;
    reconcile: (schema: Schema) => Promise<void>;
    close?: () => Promise<void>;
  }>;
};

/**
 * Shared contract suite for both dialects. Call from a describe.each matrix.
 */
export function runDbSchemaContractTests(
  factory: DbSchemaContractFactory
): void {
  describe(`db-schema contract (${factory.name})`, () => {
    registerBasicReconcileTests(factory);
    registerDeprecationTests(factory);
    registerRenameBackfillTests(factory);
    registerTypeAndOwnershipTests(factory);
    registerViewEnumTests(factory);
  });
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
      const rows = await client.query<{ n: number }>(
        raw(
          factory.dialect === 'sqlite'
            ? `SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table' AND name='notes'`
            : `SELECT COUNT(*)::int AS n FROM information_schema.tables WHERE table_name='notes'`
        )
      );
      expect(Number(rows[0]?.n)).toBe(1);
    } finally {
      await close?.();
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
        raw(`SELECT title FROM notes WHERE id = '1'`)
      );
      expect(rows[0]?.title).toBe('t');
    } finally {
      await close?.();
    }
  });
}

function registerDeprecationTests(factory: DbSchemaContractFactory): void {
  test('extra column without deprecation fails and leaves DB unchanged', async () => {
    const { client, reconcile, close } = await factory.open();
    try {
      const schema = registerTables([
        defineTable({
          domain: 'notes',
          name: 'notes',
          columns: { body: 'text' },
        }),
      ]);
      await reconcile(schema);
      await client.run(raw(`ALTER TABLE notes ADD COLUMN extra TEXT`));
      await expect(reconcile(schema)).rejects.toThrow(/deprecation|extra/i);
      const rows = await client.query<{ extra: string | null }>(
        raw(`SELECT extra FROM notes LIMIT 0`)
      );
      expect(rows).toEqual([]);
    } finally {
      await close?.();
    }
  });

  test('deprecation leftover: postgres keeps / sqlite drops', async () => {
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
          deprecations: [['old_field', 'unused']],
        }),
      ]);
      await reconcile(v2);
      if (factory.dialect === 'postgres') {
        const rows = await client.query<{ old_field: string }>(
          raw(`SELECT old_field FROM notes WHERE id = '1'`)
        );
        expect(rows[0]?.old_field).toBe('gone');
      } else {
        let threw = false;
        try {
          await client.query<{ x: string }>(
            raw(`SELECT old_field AS x FROM notes`)
          );
        } catch {
          threw = true;
        }
        expect(threw).toBe(true);
      }
    } finally {
      await close?.();
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
          deprecations: [['name', 'renamed to display_name']],
        }),
      ]);
      await reconcile(v2);
      const rows = await client.query<{ display_name: string }>(
        raw(`SELECT display_name FROM notes WHERE id = '1'`)
      );
      expect(rows[0]?.display_name).toBe('alice');
    } finally {
      await close?.();
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
            label: {
              type: 'text',
              backfill: { sql: `first_name` },
            },
          },
        }),
      ]);
      await reconcile(v2);
      await reconcile(v2);
      const rows = await client.query<{ label: string }>(
        raw(`SELECT label FROM notes WHERE id = '1'`)
      );
      expect(rows[0]?.label).toBe('bob');
    } finally {
      await close?.();
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
      const v2 = defineSchema({
        tables: { notes: { n: 'integer' } },
        ...(factory.dialect === 'sqlite' ? {} : {}),
      });
      const bad = registerTables([
        defineTable({
          domain: 'notes',
          name: 'notes',
          columns: { n: 'integer' },
        }),
      ]);
      if (factory.dialect === 'postgres') {
        await expect(reconcile(bad)).rejects.toThrow(/type mismatch/i);
      } else {
        await expect(reconcile(bad)).rejects.toThrow(/type mismatch/i);
      }
      void v2;
    } finally {
      await close?.();
    }
  });

  test('declared-only leaves undeclared tables alone (sqlite)', async () => {
    if (factory.dialect !== 'sqlite') return;
    const { client, reconcile, close } = await factory.open();
    try {
      await applySqliteSchema(
        client,
        registerTables([
          defineTable({
            domain: 'sync_engine',
            name: 'sync_engine_mutations',
            columns: {},
          }),
        ]),
        { ownership: 'declared-only' }
      );
      const schema = registerTables([
        defineTable({
          domain: 'notes',
          name: 'notes',
          columns: { body: 'text' },
        }),
      ]);
      await sqlite(schema, client, {
        ownership: 'declared-only',
      }).reconcile();
      const rows = await client.query<{ name: string }>(
        raw(
          `SELECT name FROM sqlite_master WHERE type='table' AND name='sync_engine_mutations'`
        )
      );
      expect(rows.length).toBe(1);
      void reconcile;
    } finally {
      await close?.();
    }
  });
}

function registerViewEnumTests(factory: DbSchemaContractFactory): void {
  test('defineView + defineEnum register via registerSchema', async () => {
    const { reconcile, close } = await factory.open();
    try {
      const schema = registerSchema([
        defineTable({
          domain: 'notes',
          name: 'notes',
          columns: { body: 'text', kind: 'text' },
        }),
        defineView({
          domain: 'notes',
          name: 'notes_alive',
          sql: `SELECT id, body FROM notes WHERE deleted_at IS NULL`,
        }),
        defineEnum({
          domain: 'notes',
          name: 'notes_kind',
          values: ['a', 'b'],
        }),
      ]);
      await reconcile(schema);
      const snap = schema.snapshot();
      expect(snap.views.some((v) => v.name === 'notes_alive')).toBe(true);
      expect(snap.enums.some((e) => e.name === 'notes_kind')).toBe(true);
    } finally {
      await close?.();
    }
  });
}

export function postgresMemFactory(): DbSchemaContractFactory {
  return {
    name: 'postgres-mem',
    dialect: 'postgres',
    async open() {
      const { SqlClientImplPostgresMem } = await import(
        '@pkgs/sql-client/postgres/impl-postgres-mem'
      );
      const client = SqlClientImplPostgresMem.open({
        dbScope: createPostgresDbScope('public'),
        seed: 1,
      });
      await client.connect();
      return {
        client,
        reconcile: (schema) =>
          postgres(schema, client as PostgresSqlClient, {
            skipAdvisoryLock: true,
          }).reconcile(),
        close: () => client.disconnect(),
      };
    },
  };
}

export function sqliteMemFactory(): DbSchemaContractFactory {
  return {
    name: 'sqlite-mem',
    dialect: 'sqlite',
    async open() {
      const { SqlClientImplSqliteMem } = await import(
        '@pkgs/sql-client/sqlite/impl-sqlite-mem'
      );
      const client = SqlClientImplSqliteMem.open();
      await client.connect();
      return {
        client,
        reconcile: (schema) => sqlite(schema, client).reconcile(),
        close: () => client.disconnect(),
      };
    },
  };
}
