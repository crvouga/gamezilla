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
    expect(kinds.filter((k) => k === 'create_index').length).toBe(2);
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
            { name: '_id', type: 'uuid', nullable: false, isPrimaryKey: true },
            { name: '_created_at', type: 'timestamp' },
            { name: '_updated_at', type: 'timestamp' },
            { name: '_deleted_at', type: 'timestamp' },
            { name: 'user_id', type: 'text' }, // should be uuid
            { name: 'title', type: 'text' },
            { name: 'done', type: 'boolean' },
            { name: 'status', type: 'text' },
            { name: 'created_at', type: 'timestamp' },
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
          created_at: 'timestamp',
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

  test('managed _id type mismatch is drift', () => {
    const catalog: IntrospectedCatalog = {
      tables: new Map([
        [
          'todos',
          tableWithColumns('todos', [
            { name: '_id', type: 'text', nullable: false, isPrimaryKey: true },
            { name: '_created_at', type: 'timestamp' },
            { name: '_updated_at', type: 'timestamp' },
            { name: '_deleted_at', type: 'timestamp' },
            { name: 'user_id', type: 'uuid' },
            { name: 'title', type: 'text' },
            { name: 'done', type: 'boolean' },
            { name: 'status', type: 'text' },
            { name: 'created_at', type: 'timestamp' },
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
    expect(plan.drift.some((d) => d.path === 'todos._id')).toBe(true);
  });

  test('deprecated column missing from existing table is drift', () => {
    const catalog: IntrospectedCatalog = {
      tables: new Map([
        [
          'users',
          tableWithColumns('users', [
            { name: '_id', type: 'uuid', nullable: false, isPrimaryKey: true },
            { name: '_created_at', type: 'timestamp' },
            { name: '_updated_at', type: 'timestamp' },
            { name: '_deleted_at', type: 'timestamp' },
            { name: 'email', type: 'text' },
            { name: 'display_name', type: 'text' },
            // name (deprecated) missing
          ]),
        ],
      ]),
      indexes: [],
      allTableNames: new Set(['users']),
    };
    const plan = planServer(sampleSchema._declared, catalog);
    expect(plan.ok).toBe(false);
    if (plan.ok) return;
    expect(plan.drift.some((d) => d.path === 'users.name')).toBe(true);
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

  test('index fingerprint add/drop', () => {
    const schema = defineSchema({
      tables: {
        todos: {
          user_id: 'uuid',
          title: 'text',
          done: 'boolean',
          status: 'text',
          created_at: 'timestamp',
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
  test('never returns drift — converges extras via rebuild', () => {
    const catalog: IntrospectedCatalog = {
      tables: new Map([
        [
          'todos',
          tableWithColumns('todos', [
            { name: '_id', type: 'TEXT', nullable: false, isPrimaryKey: true },
            { name: '_created_at', type: 'INTEGER' },
            { name: '_updated_at', type: 'INTEGER' },
            { name: '_deleted_at', type: 'INTEGER' },
            { name: 'user_id', type: 'TEXT' },
            { name: 'title', type: 'TEXT' },
            { name: 'done', type: 'INTEGER' },
            { name: 'status', type: 'TEXT' },
            { name: 'created_at', type: 'INTEGER' },
            { name: 'due_at', type: 'INTEGER' },
            { name: 'extra_col', type: 'TEXT' },
          ]),
        ],
      ]),
      indexes: [],
      allTableNames: new Set(['todos', 'ghost']),
    };
    const ops = planClient(sampleSchema._declared, catalog);
    expect(
      ops.some((o) => o.kind === 'drop_table' && o.table === 'ghost')
    ).toBe(true);
    expect(
      ops.some((o) => o.kind === 'rebuild_table' && o.table === 'todos')
    ).toBe(true);
  });

  test('preserves _meta through rebuild plan', () => {
    const catalog: IntrospectedCatalog = {
      tables: new Map([
        [
          'todos',
          tableWithColumns('todos', [
            { name: '_id', type: 'TEXT', nullable: false, isPrimaryKey: true },
            { name: '_created_at', type: 'INTEGER' },
            { name: '_updated_at', type: 'INTEGER' },
            { name: '_deleted_at', type: 'INTEGER' },
            { name: 'user_id', type: 'TEXT' },
            { name: 'title', type: 'TEXT' },
            { name: 'done', type: 'INTEGER' },
            { name: 'status', type: 'TEXT' },
            { name: 'created_at', type: 'INTEGER' },
            { name: 'due_at', type: 'INTEGER' },
            { name: 'extra_col', type: 'TEXT' },
            { name: '_meta', type: 'TEXT' },
          ]),
        ],
      ]),
      indexes: [],
      allTableNames: new Set(['todos']),
    };
    const ops = planClient(sampleSchema._declared, catalog);
    const rebuild = ops.find((o) => o.kind === 'rebuild_table');
    expect(rebuild?.kind).toBe('rebuild_table');
    if (rebuild?.kind !== 'rebuild_table') return;
    expect([...rebuild.preserveUnderscoreExtras] as string[]).toContain(
      '_meta'
    );
    expect([...rebuild.copyColumns] as string[]).toContain('_meta');
  });

  test('managed _id physical mismatch converges via rebuild', () => {
    const catalog: IntrospectedCatalog = {
      tables: new Map([
        [
          'todos',
          tableWithColumns('todos', [
            // wrong physical type for uuid → TEXT expected; INTEGER is mismatch
            {
              name: '_id',
              type: 'INTEGER',
              nullable: false,
              isPrimaryKey: true,
            },
            { name: '_created_at', type: 'INTEGER' },
            { name: '_updated_at', type: 'INTEGER' },
            { name: '_deleted_at', type: 'INTEGER' },
            { name: 'user_id', type: 'TEXT' },
            { name: 'title', type: 'TEXT' },
            { name: 'done', type: 'INTEGER' },
            { name: 'status', type: 'TEXT' },
            { name: 'created_at', type: 'INTEGER' },
            { name: 'due_at', type: 'INTEGER' },
          ]),
        ],
      ]),
      indexes: [],
      allTableNames: new Set(['todos']),
    };
    const ops = planClient(sampleSchema._declared, catalog);
    expect(ops.some((o) => o.kind === 'rebuild_table')).toBe(true);
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
              name: '_id',
              type: SQLITE_TYPE_SQL.uuid,
              nullable: false,
              isPrimaryKey: true,
            },
            { name: '_created_at', type: SQLITE_TYPE_SQL.timestamp },
            { name: '_updated_at', type: SQLITE_TYPE_SQL.timestamp },
            { name: '_deleted_at', type: SQLITE_TYPE_SQL.timestamp },
            { name: 'body', type: SQLITE_TYPE_SQL.text },
          ]),
        ],
      ]),
      indexes: [],
      allTableNames: new Set(['notes']),
    };
    const ops = planClient(schema._declared, catalog);
    expect(ops.some((o) => o.kind === 'rebuild_table')).toBe(false);
    expect(
      ops.some((o) => o.kind === 'add_column' && o.column === 'title')
    ).toBe(true);
  });

  test('declared-only ownership does not drop undeclared tables', () => {
    const catalog: IntrospectedCatalog = {
      tables: new Map([
        [
          'todos',
          tableWithColumns('todos', [
            { name: '_id', type: 'TEXT', nullable: false, isPrimaryKey: true },
            { name: '_created_at', type: 'INTEGER' },
            { name: '_updated_at', type: 'INTEGER' },
            { name: '_deleted_at', type: 'INTEGER' },
            { name: 'user_id', type: 'TEXT' },
            { name: 'title', type: 'TEXT' },
            { name: 'done', type: 'INTEGER' },
            { name: 'status', type: 'TEXT' },
            { name: 'created_at', type: 'INTEGER' },
            { name: 'due_at', type: 'INTEGER' },
          ]),
        ],
      ]),
      indexes: [],
      allTableNames: new Set(['todos', '_mutations', 'ghost']),
    };
    const ops = planClient(sampleSchema._declared, catalog, {
      ownership: 'declared-only',
    });
    expect(ops.some((o) => o.kind === 'drop_table')).toBe(false);
  });
});

describe('planServer unique indexes', () => {
  test('plans unique create_index with unique flag', () => {
    const schema = defineSchema({
      tables: { notes: { id: 'text', body: 'text' } },
      uniqueIndexes: [['notes', 'id']],
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
