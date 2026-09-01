import { describe, expect, test } from 'bun:test';
import {
  emptyCatalog,
  fingerprintForIndexDef,
  fullTodosTable,
  sampleSchema,
  tableWithColumns,
} from '../test/fixtures';
import { defineSchema } from './define-schema';
import { planClient, planServer } from './plan';
import { SQLITE_TYPE_SQL } from './type-map';
import type { IntrospectedCatalog } from './types';

describe('planServer', () => {
  test('fresh DB plans create_table for all tables + indexes', () => {
    const plan = planServer(sampleSchema._declared, emptyCatalog());
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    const kinds = plan.operations.map((o) => o.kind);
    expect(kinds.filter((k) => k === 'create_table').length).toBe(3);
    expect(kinds.filter((k) => k === 'create_index').length).toBe(3);
  });

  test('extra user column is drift (not an operation)', () => {
    const catalog: IntrospectedCatalog = {
      tables: new Map([
        ['todos', fullTodosTable([{ name: 'extra_col', type: 'text' }])],
      ]),
      indexes: [],
      allTableNames: new Set(['todos']),
    };
    const plan = planServer(sampleSchema._declared, catalog);
    expect(plan.ok).toBe(false);
    if (plan.ok) return;
    expect(plan.drift.some((d) => d.path === 'todos.extra_col')).toBe(true);
  });

  test('type mismatch is drift', () => {
    const catalog: IntrospectedCatalog = {
      tables: new Map([
        [
          'todos',
          tableWithColumns('todos', [
            { name: 'id', type: 'text', nullable: false, isPrimaryKey: true },
            { name: 'created_at', type: 'timestamp' },
            { name: 'updated_at', type: 'timestamp' },
            { name: 'deleted_at', type: 'timestamp' },
            { name: 'user_id', type: 'text' }, // should be uuid
            { name: 'title', type: 'text' },
            { name: 'done', type: 'boolean' },
            { name: 'status', type: 'text' },
            { name: 'due_at', type: 'timestamp' },
          ]),
        ],
      ]),
      indexes: [],
      allTableNames: new Set(['todos']),
    };
    const plan = planServer(sampleSchema._declared, catalog);
    expect(plan.ok).toBe(false);
    if (plan.ok) return;
    expect(plan.drift.some((d) => d.path === 'todos.user_id')).toBe(true);
  });

  test('non-managed _meta is invisible (no drift, no op)', () => {
    const schema = defineSchema({
      tables: {
        todos: {
          user_id: 'uuid',
          title: 'text',
          done: 'boolean',
          status: 'text',
          due_at: 'timestamp',
        },
      },
    });
    const catalog: IntrospectedCatalog = {
      tables: new Map([
        ['todos', fullTodosTable([{ name: '_meta', type: 'text' }])],
      ]),
      indexes: [],
      allTableNames: new Set(['todos']),
    };
    const plan = planServer(schema._declared, catalog);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(
      plan.operations.some(
        (o) => o.kind === 'add_column' && String(o.column) === '_meta'
      )
    ).toBe(false);
  });

  test('managed id type mismatch is drift', () => {
    const catalog: IntrospectedCatalog = {
      tables: new Map([
        [
          'todos',
          tableWithColumns('todos', [
            { name: 'id', type: 'uuid', nullable: false, isPrimaryKey: true },
            { name: 'created_at', type: 'timestamp' },
            { name: 'updated_at', type: 'timestamp' },
            { name: 'deleted_at', type: 'timestamp' },
            { name: 'user_id', type: 'uuid' },
            { name: 'title', type: 'text' },
            { name: 'done', type: 'boolean' },
            { name: 'status', type: 'text' },
            { name: 'due_at', type: 'timestamp' },
          ]),
        ],
      ]),
      indexes: [],
      allTableNames: new Set(['todos']),
    };
    const plan = planServer(sampleSchema._declared, catalog);
    expect(plan.ok).toBe(false);
    if (plan.ok) return;
    expect(plan.drift.some((d) => d.path === 'todos.id')).toBe(true);
  });

  test('deprecated leftover column is not drift', () => {
    const catalog: IntrospectedCatalog = {
      tables: new Map([
        [
          'users',
          tableWithColumns('users', [
            { name: 'id', type: 'text', nullable: false, isPrimaryKey: true },
            { name: 'created_at', type: 'timestamp' },
            { name: 'updated_at', type: 'timestamp' },
            { name: 'deleted_at', type: 'timestamp' },
            { name: 'email', type: 'text' },
            { name: 'display_name', type: 'text' },
            { name: 'name', type: 'text' },
          ]),
        ],
        [
          'legacy_notes',
          tableWithColumns('legacy_notes', [
            { name: 'id', type: 'text', nullable: false, isPrimaryKey: true },
            { name: 'created_at', type: 'timestamp' },
            { name: 'updated_at', type: 'timestamp' },
            { name: 'deleted_at', type: 'timestamp' },
            { name: 'body', type: 'text' },
          ]),
        ],
      ]),
      indexes: [],
      allTableNames: new Set(['users', 'legacy_notes']),
    };
    const plan = planServer(sampleSchema._declared, catalog);
    expect(plan.ok).toBe(true);
  });

  test('deprecated column missing from existing table is ok', () => {
    const catalog: IntrospectedCatalog = {
      tables: new Map([
        [
          'users',
          tableWithColumns('users', [
            { name: 'id', type: 'text', nullable: false, isPrimaryKey: true },
            { name: 'created_at', type: 'timestamp' },
            { name: 'updated_at', type: 'timestamp' },
            { name: 'deleted_at', type: 'timestamp' },
            { name: 'email', type: 'text' },
            { name: 'display_name', type: 'text' },
          ]),
        ],
        [
          'legacy_notes',
          tableWithColumns('legacy_notes', [
            { name: 'id', type: 'text', nullable: false, isPrimaryKey: true },
            { name: 'created_at', type: 'timestamp' },
            { name: 'updated_at', type: 'timestamp' },
            { name: 'deleted_at', type: 'timestamp' },
            { name: 'body', type: 'text' },
          ]),
        ],
      ]),
      indexes: [],
      allTableNames: new Set(['users', 'legacy_notes']),
    };
    const plan = planServer(sampleSchema._declared, catalog);
    expect(plan.ok).toBe(true);
  });

  test('undeclared non-deprecated leftover column is drift', () => {
    const catalog: IntrospectedCatalog = {
      tables: new Map([
        [
          'users',
          tableWithColumns('users', [
            { name: 'id', type: 'text', nullable: false, isPrimaryKey: true },
            { name: 'created_at', type: 'timestamp' },
            { name: 'updated_at', type: 'timestamp' },
            { name: 'deleted_at', type: 'timestamp' },
            { name: 'email', type: 'text' },
            { name: 'display_name', type: 'text' },
            { name: 'mystery', type: 'text' },
          ]),
        ],
        [
          'legacy_notes',
          tableWithColumns('legacy_notes', [
            { name: 'id', type: 'text', nullable: false, isPrimaryKey: true },
            { name: 'created_at', type: 'timestamp' },
            { name: 'updated_at', type: 'timestamp' },
            { name: 'deleted_at', type: 'timestamp' },
            { name: 'body', type: 'text' },
          ]),
        ],
      ]),
      indexes: [],
      allTableNames: new Set(['users', 'legacy_notes']),
    };
    const plan = planServer(sampleSchema._declared, catalog);
    expect(plan.ok).toBe(false);
    if (plan.ok) return;
    expect(plan.drift.some((d) => d.path === 'users.mystery')).toBe(true);
  });

  test('undeclared table is invisible (no drift)', () => {
    const catalog: IntrospectedCatalog = {
      tables: new Map(),
      indexes: [],
      allTableNames: new Set(['foreign_billing']),
    };
    const plan = planServer(sampleSchema._declared, catalog);
    expect(plan.ok).toBe(true);
  });

  test('int4 physical type matches declared integer', () => {
    const schema = defineSchema({
      tables: {
        puzzles: {
          rating: 'integer',
          body: 'text',
        },
      },
    });
    const catalog: IntrospectedCatalog = {
      tables: new Map([
        [
          'puzzles',
          tableWithColumns('puzzles', [
            { name: 'id', type: 'text', nullable: false, isPrimaryKey: true },
            { name: 'created_at', type: 'timestamp' },
            { name: 'updated_at', type: 'timestamp' },
            { name: 'deleted_at', type: 'timestamp' },
            { name: 'rating', type: 'integer', nullable: true },
            { name: 'body', type: 'text', nullable: true },
          ]),
        ],
      ]),
      indexes: [],
      allTableNames: new Set(['puzzles']),
    };
    const plan = planServer(schema._declared, catalog);
    expect(plan.ok).toBe(true);
  });

  test('index fingerprint add/drop', () => {
    const schema = defineSchema({
      tables: {
        todos: {
          user_id: 'uuid',
          title: 'text',
          done: 'boolean',
          status: 'text',
          due_at: 'timestamp',
        },
      },
      indexes: [
        ['todos', 'user_id'],
        ['todos', 'due_at'],
      ],
    });
    const ixUser = fingerprintForIndexDef(['todos', 'user_id']);
    const stale = fingerprintForIndexDef(['todos', 'title']);
    const catalog: IntrospectedCatalog = {
      tables: new Map([['todos', fullTodosTable()]]),
      indexes: [
        { name: ixUser, table: 'todos', columns: ['user_id'] },
        { name: stale, table: 'todos', columns: ['title'] },
        { name: 'manual_ix', table: 'todos', columns: ['status'] },
      ],
      allTableNames: new Set(['todos']),
    };
    const plan = planServer(schema._declared, catalog);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(
      plan.operations.some((o) => o.kind === 'drop_index' && o.name === stale)
    ).toBe(true);
    expect(
      plan.operations.some(
        (o) => o.kind === 'create_index' && o.columns[0] === 'due_at'
      )
    ).toBe(true);
    expect(
      plan.operations.some(
        (o) => o.kind === 'drop_index' && o.name === 'manual_ix'
      )
    ).toBe(false);
  });
});

describe('planClient', () => {
  test('non-deprecated extra column is drift (not silent rebuild)', () => {
    const catalog: IntrospectedCatalog = {
      tables: new Map([
        [
          'todos',
          tableWithColumns('todos', [
            { name: 'id', type: 'TEXT', nullable: false, isPrimaryKey: true },
            { name: 'created_at', type: 'TEXT' },
            { name: 'updated_at', type: 'TEXT' },
            { name: 'deleted_at', type: 'TEXT' },
            { name: 'user_id', type: 'TEXT' },
            { name: 'title', type: 'TEXT' },
            { name: 'done', type: 'INTEGER' },
            { name: 'status', type: 'TEXT' },
            { name: 'due_at', type: 'TEXT' },
            { name: 'extra_col', type: 'TEXT' },
          ]),
        ],
      ]),
      indexes: [],
      allTableNames: new Set(['todos', 'ghost']),
    };
    const plan = planClient(sampleSchema._declared, catalog);
    expect(plan.ok).toBe(false);
    if (plan.ok) return;
    expect(plan.drift.some((d) => d.path === 'todos.extra_col')).toBe(true);
  });

  test('deprecated extra column rebuilds; undeclared tables drop under whole-db', () => {
    const schema = defineSchema({
      tables: {
        todos: {
          user_id: 'uuid',
          title: 'text',
          done: 'boolean',
          status: 'text',
          due_at: 'timestamp',
        },
      },
      deprecations: [['todos', 'extra_col', 'unused']],
    });
    const catalog: IntrospectedCatalog = {
      tables: new Map([
        [
          'todos',
          tableWithColumns('todos', [
            { name: 'id', type: 'TEXT', nullable: false, isPrimaryKey: true },
            { name: 'created_at', type: 'TEXT' },
            { name: 'updated_at', type: 'TEXT' },
            { name: 'deleted_at', type: 'TEXT' },
            { name: 'user_id', type: 'TEXT' },
            { name: 'title', type: 'TEXT' },
            { name: 'done', type: 'INTEGER' },
            { name: 'status', type: 'TEXT' },
            { name: 'due_at', type: 'TEXT' },
            { name: 'extra_col', type: 'TEXT' },
          ]),
        ],
      ]),
      indexes: [],
      allTableNames: new Set(['todos', 'ghost']),
    };
    const plan = planClient(schema._declared, catalog, {
      ownership: 'whole-db',
    });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(
      plan.operations.some(
        (o) => o.kind === 'drop_table' && o.table === 'ghost'
      )
    ).toBe(true);
    expect(
      plan.operations.some(
        (o) => o.kind === 'rebuild_table' && o.table === 'todos'
      )
    ).toBe(true);
  });

  test('preserves _meta through rebuild plan', () => {
    const schema = defineSchema({
      tables: {
        todos: {
          user_id: 'uuid',
          title: 'text',
          done: 'boolean',
          status: 'text',
          due_at: 'timestamp',
        },
      },
      deprecations: [['todos', 'extra_col', 'unused']],
    });
    const catalog: IntrospectedCatalog = {
      tables: new Map([
        [
          'todos',
          tableWithColumns('todos', [
            { name: 'id', type: 'TEXT', nullable: false, isPrimaryKey: true },
            { name: 'created_at', type: 'TEXT' },
            { name: 'updated_at', type: 'TEXT' },
            { name: 'deleted_at', type: 'TEXT' },
            { name: 'user_id', type: 'TEXT' },
            { name: 'title', type: 'TEXT' },
            { name: 'done', type: 'INTEGER' },
            { name: 'status', type: 'TEXT' },
            { name: 'due_at', type: 'TEXT' },
            { name: 'extra_col', type: 'TEXT' },
            { name: '_meta', type: 'TEXT' },
          ]),
        ],
      ]),
      indexes: [],
      allTableNames: new Set(['todos']),
    };
    const plan = planClient(schema._declared, catalog);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    const rebuild = plan.operations.find((o) => o.kind === 'rebuild_table');
    expect(rebuild?.kind).toBe('rebuild_table');
    if (rebuild?.kind !== 'rebuild_table') return;
    expect([...rebuild.preserveUnderscoreExtras] as string[]).toContain(
      '_meta'
    );
    expect([...rebuild.copyColumns] as string[]).toContain('_meta');
  });

  test('managed id physical mismatch is drift on client', () => {
    const catalog: IntrospectedCatalog = {
      tables: new Map([
        [
          'todos',
          tableWithColumns('todos', [
            {
              name: 'id',
              type: 'INTEGER',
              nullable: false,
              isPrimaryKey: true,
            },
            { name: 'created_at', type: 'TEXT' },
            { name: 'updated_at', type: 'TEXT' },
            { name: 'deleted_at', type: 'TEXT' },
            { name: 'user_id', type: 'TEXT' },
            { name: 'title', type: 'TEXT' },
            { name: 'done', type: 'INTEGER' },
            { name: 'status', type: 'TEXT' },
            { name: 'due_at', type: 'TEXT' },
          ]),
        ],
      ]),
      indexes: [],
      allTableNames: new Set(['todos']),
    };
    const plan = planClient(sampleSchema._declared, catalog);
    expect(plan.ok).toBe(false);
    if (plan.ok) return;
    expect(plan.drift.some((d) => d.path === 'todos.id')).toBe(true);
  });

  test('additive missing column without rebuild', () => {
    const schema = defineSchema({
      tables: { notes: { body: 'text', title: 'text' } },
    });
    const catalog: IntrospectedCatalog = {
      tables: new Map([
        [
          'notes',
          tableWithColumns('notes', [
            {
              name: 'id',
              type: SQLITE_TYPE_SQL.text,
              nullable: false,
              isPrimaryKey: true,
            },
            { name: 'created_at', type: SQLITE_TYPE_SQL.timestamp },
            { name: 'updated_at', type: SQLITE_TYPE_SQL.timestamp },
            { name: 'deleted_at', type: SQLITE_TYPE_SQL.timestamp },
            { name: 'body', type: SQLITE_TYPE_SQL.text },
          ]),
        ],
      ]),
      indexes: [],
      allTableNames: new Set(['notes']),
    };
    const plan = planClient(schema._declared, catalog);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.operations.some((o) => o.kind === 'rebuild_table')).toBe(false);
    expect(
      plan.operations.some(
        (o) => o.kind === 'add_column' && o.column === 'title'
      )
    ).toBe(true);
  });

  test('declared-only ownership does not drop undeclared tables', () => {
    const catalog: IntrospectedCatalog = {
      tables: new Map([
        [
          'todos',
          tableWithColumns('todos', [
            { name: 'id', type: 'TEXT', nullable: false, isPrimaryKey: true },
            { name: 'created_at', type: 'TEXT' },
            { name: 'updated_at', type: 'TEXT' },
            { name: 'deleted_at', type: 'TEXT' },
            { name: 'user_id', type: 'TEXT' },
            { name: 'title', type: 'TEXT' },
            { name: 'done', type: 'INTEGER' },
            { name: 'status', type: 'TEXT' },
            { name: 'due_at', type: 'TEXT' },
          ]),
        ],
      ]),
      indexes: [],
      allTableNames: new Set(['todos', 'sync_engine_mutations', 'ghost']),
    };
    const plan = planClient(sampleSchema._declared, catalog, {
      ownership: 'declared-only',
    });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.operations.some((o) => o.kind === 'drop_table')).toBe(false);
  });
});

describe('planServer unique indexes', () => {
  test('plans unique create_index with unique flag', () => {
    const schema = defineSchema({
      tables: { notes: { body: 'text', slug: 'text' } },
      uniqueIndexes: [['notes', 'slug']],
      indexes: [['notes', 'body']],
    });
    const plan = planServer(schema._declared, emptyCatalog());
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    const uniqueIx = plan.operations.find(
      (o) => o.kind === 'create_index' && o.unique
    );
    const plainIx = plan.operations.find(
      (o) => o.kind === 'create_index' && !o.unique
    );
    expect(uniqueIx?.kind).toBe('create_index');
    expect(plainIx?.kind).toBe('create_index');
    if (uniqueIx?.kind === 'create_index') {
      expect(uniqueIx.name.startsWith('ux_')).toBe(true);
    }
    if (plainIx?.kind === 'create_index') {
      expect(plainIx.name.startsWith('ix_')).toBe(true);
    }
  });
});
