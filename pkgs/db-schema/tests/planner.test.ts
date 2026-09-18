import { describe, expect, test } from 'bun:test';
import { defineTable, registerTables } from '@pkgs/db-schema';
import { classifyDelta } from '@pkgs/db-schema/core/compatibility';
import { SQLITE_CAPS } from '@pkgs/db-schema/core/dialect-caps';
import type { ClientOperation } from '@pkgs/db-schema/core/operations';
import { planClient, planServer } from '@pkgs/db-schema/core/plan';
import type {
  ColumnType,
  IntrospectedCatalog,
  IntrospectedColumn,
  IntrospectedTable,
  ReadonlyDeclaredSchema,
} from '@pkgs/db-schema/core/types';

type Dialect = 'postgres' | 'sqlite';

const PG_PHYSICAL: Record<ColumnType, string> = {
  uuid: 'uuid',
  text: 'text',
  integer: 'bigint',
  boolean: 'boolean',
  timestamp: 'timestamptz',
  json: 'jsonb',
  real: 'double precision',
  blob: 'bytea',
  numeric: 'numeric',
  date: 'date',
};

const SQLITE_PHYSICAL: Record<ColumnType, string> = {
  uuid: 'TEXT',
  text: 'TEXT',
  integer: 'INTEGER',
  boolean: 'INTEGER',
  timestamp: 'TEXT',
  json: 'TEXT',
  real: 'REAL',
  blob: 'BLOB',
  numeric: 'TEXT',
  date: 'TEXT',
};

const MANAGED = [
  { name: 'id', type: 'text', pk: true },
  { name: 'created_at', type: 'timestamp', pk: false },
  { name: 'updated_at', type: 'timestamp', pk: false },
  { name: 'deleted_at', type: 'timestamp', pk: false },
] as const satisfies readonly {
  name: string;
  type: ColumnType;
  pk: boolean;
}[];

type ColumnInput = {
  readonly name: string;
  readonly type: ColumnType;
  readonly physical?: string;
  readonly nullable?: boolean;
  readonly pk?: boolean;
};

function table(
  name: string,
  dialect: Dialect,
  columns: readonly ColumnInput[]
): IntrospectedTable {
  const physicalOf = dialect === 'postgres' ? PG_PHYSICAL : SQLITE_PHYSICAL;
  const introspected: IntrospectedColumn[] = [];
  for (const managed of MANAGED) {
    introspected.push({
      name: managed.name,
      type: managed.type,
      physical: physicalOf[managed.type],
      nullable: !managed.pk,
      isPrimaryKey: managed.pk,
    });
  }
  for (const column of columns) {
    introspected.push({
      name: column.name,
      type: column.type,
      physical: column.physical ?? physicalOf[column.type],
      nullable: column.nullable ?? !(column.pk ?? false),
      isPrimaryKey: column.pk ?? false,
    });
  }
  return { name, columns: introspected };
}

function catalog(input: {
  readonly tables?: readonly IntrospectedTable[];
  readonly allTableNames?: readonly string[];
}): IntrospectedCatalog {
  const tables = new Map<string, IntrospectedTable>();
  for (const entry of input.tables ?? []) tables.set(entry.name, entry);
  return {
    tables,
    indexes: [],
    allTableNames: new Set(input.allTableNames ?? [...tables.keys()]),
  };
}

function declared(
  tables: Parameters<typeof registerTables>[0]
): ReadonlyDeclaredSchema {
  return registerTables(tables)._declared;
}

function addedColumns(ops: readonly ClientOperation[]): string[] {
  return ops.flatMap((op) =>
    op.kind === 'add_column' ? [String(op.column)] : []
  );
}

describe('planClient — fresh create and additive columns', () => {
  test('a fresh empty catalog creates the table, managed implicits first, id as PK', () => {
    const schema = declared([
      defineTable({ domain: 'alpha', name: 'alpha', columns: { a: 'text' } }),
    ]);
    const expectedOrder = ['id', 'created_at', 'updated_at', 'deleted_at', 'a'];

    const client = planClient(schema, catalog({}));
    if (!client.ok) throw new Error('expected client plan to succeed');
    expect(client.operations.map((op) => op.kind)).toEqual(['create_table']);
    const clientCreate = client.operations[0];
    if (clientCreate?.kind !== 'create_table') {
      throw new Error('expected create_table');
    }
    expect(clientCreate.columns.map((c) => String(c.name))).toEqual(
      expectedOrder
    );
    expect(clientCreate.columns[0]!.isPrimaryKey).toBe(true);
    expect(clientCreate.columns.slice(1).every((c) => !c.isPrimaryKey)).toBe(
      true
    );

    const server = planServer(schema, catalog({}));
    if (!server.ok) throw new Error('expected server plan to succeed');
    const serverCreate = server.operations[0];
    if (serverCreate?.kind !== 'create_table') {
      throw new Error('expected create_table');
    }
    expect(serverCreate.columns.map((c) => String(c.name))).toEqual(
      expectedOrder
    );
    expect(serverCreate.columns[0]!.isPrimaryKey).toBe(true);
  });

  test('additive columns emit add_column plus a backfill for a lifecycle source', () => {
    const schema = declared([
      defineTable({
        domain: 'alpha',
        name: 'alpha',
        columns: {
          a: 'text',
          b: 'text',
          c: { type: 'text', renamedFrom: 'old_c' },
        },
        retiredColumns: [{ name: 'old_c', type: 'text', note: 'legacy c' }],
      }),
    ]);
    const existing = catalog({
      tables: [table('alpha', 'sqlite', [{ name: 'a', type: 'text' }])],
    });

    const result = planClient(schema, existing);
    if (!result.ok) throw new Error('expected client plan to succeed');
    expect(result.operations.map((op) => op.kind)).not.toContain(
      'rebuild_table'
    );
    expect(addedColumns(result.operations)).toEqual(['b', 'c']);

    const backfills = result.operations.filter((op) => op.kind === 'backfill');
    expect(backfills).toHaveLength(1);
    const backfill = backfills[0];
    if (backfill?.kind !== 'backfill') throw new Error('expected backfill');
    expect(String(backfill.column)).toBe('c');
    expect(backfill.expression).toBe('"old_c"');
  });
});

describe('planServer — fail-closed drift on extra and retired columns', () => {
  test('an undeclared catalog column without a tombstone is drift', () => {
    const schema = declared([
      defineTable({ domain: 'alpha', name: 'alpha', columns: { a: 'text' } }),
    ]);
    const existing = catalog({
      tables: [
        table('alpha', 'postgres', [
          { name: 'a', type: 'text' },
          { name: 'legacy', type: 'text' },
        ]),
      ],
    });

    const result = planServer(schema, existing);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected drift');
    expect(result.drift.some((d) => d.path === 'alpha.legacy')).toBe(true);
    expect(result.drift.some((d) => d.message.includes('not declared'))).toBe(
      true
    );
  });

  test('a tombstone whose column changed shape is drift', () => {
    const schema = declared([
      defineTable({
        domain: 'alpha',
        name: 'alpha',
        columns: { a: 'text' },
        retiredColumns: [
          { name: 'legacy', type: 'text', note: 'old clients read legacy' },
        ],
      }),
    ]);
    const existing = catalog({
      tables: [
        table('alpha', 'postgres', [
          { name: 'a', type: 'text' },
          { name: 'legacy', type: 'integer', physical: 'bigint' },
        ]),
      ],
    });

    const result = planServer(schema, existing);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected drift');
    expect(
      result.drift.some(
        (d) =>
          d.path === 'alpha.legacy' &&
          d.message.includes('retired column changed shape')
      )
    ).toBe(true);
  });

  test('a tombstone absent from the catalog is materialized, not drift', () => {
    const schema = declared([
      defineTable({
        domain: 'alpha',
        name: 'alpha',
        columns: { a: 'text' },
        retiredColumns: [
          { name: 'legacy', type: 'text', note: 'old clients read legacy' },
        ],
      }),
    ]);
    const existing = catalog({
      tables: [table('alpha', 'postgres', [{ name: 'a', type: 'text' }])],
    });

    const result = planServer(schema, existing);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected a plan');
    expect(result.operations).toContainEqual(
      expect.objectContaining({
        kind: 'add_column',
        table: 'alpha',
        column: 'legacy',
        type: 'text',
      })
    );
  });
  test('operations filter splits table DDL from index DDL', () => {
    const schema = declared([
      defineTable({
        domain: 'alpha',
        name: 'alpha',
        columns: { a: 'text', b: 'text', c: 'text' },
        indexes: ['a'],
        uniqueIndexes: ['b'],
      }),
    ]);
    const existing = catalog({
      tables: [
        table('alpha', 'postgres', [
          { name: 'a', type: 'text' },
          { name: 'b', type: 'text' },
        ]),
      ],
    });

    const tablePlan = planServer(schema, existing, { operations: 'table' });
    if (!tablePlan.ok) throw new Error('expected table plan to succeed');
    expect(tablePlan.operations.map((op) => op.kind)).toEqual(['add_column']);
    expect(addedColumns(tablePlan.operations)).toEqual(['c']);

    const indexPlan = planServer(schema, existing, { operations: 'index' });
    if (!indexPlan.ok) throw new Error('expected index plan to succeed');
    expect(indexPlan.operations.map((op) => op.kind)).toEqual([
      'create_index',
      'create_index',
    ]);
    expect(
      indexPlan.operations.map((op) => op.kind === 'create_index' && op.unique)
    ).toEqual([false, true]);

    const allPlan = planServer(schema, existing);
    if (!allPlan.ok) throw new Error('expected full plan to succeed');
    expect(addedColumns(allPlan.operations)).toEqual(['c']);
    expect(
      allPlan.operations.filter((op) => op.kind === 'create_index')
    ).toHaveLength(2);
  });
});

describe('planClient — tolerant cache behaviour', () => {
  test('an undeclared local column is preserved, never drift', () => {
    const schema = declared([
      defineTable({ domain: 'alpha', name: 'alpha', columns: { a: 'text' } }),
    ]);
    const existing = catalog({
      tables: [
        table('alpha', 'sqlite', [
          { name: 'a', type: 'text' },
          { name: 'mystery', type: 'text' },
        ]),
      ],
    });

    const result = planClient(schema, existing);
    expect(result.ok).toBe(true);

    const classified = classifyDelta({
      declared: schema,
      catalog: existing,
      caps: SQLITE_CAPS,
      mode: 'sqlite',
    });
    expect(classified.drift).toEqual([]);
    expect(classified.preservedExtras).toEqual([
      { table: 'alpha', column: 'mystery' },
    ]);
  });

  test('a tombstoned column present locally forces a rebuild that drops it and preserves extras', () => {
    const schema = declared([
      defineTable({
        domain: 'alpha',
        name: 'alpha',
        columns: { a: 'text' },
        retiredColumns: [
          { name: 'gone', type: 'text', note: 'old clients read gone' },
        ],
      }),
    ]);
    const existing = catalog({
      tables: [
        table('alpha', 'sqlite', [
          { name: 'a', type: 'text' },
          { name: 'gone', type: 'text' },
          { name: 'mystery', type: 'integer' },
        ]),
      ],
    });

    const result = planClient(schema, existing);
    if (!result.ok) throw new Error('expected client plan to succeed');
    const rebuild = result.operations.find((op) => op.kind === 'rebuild_table');
    if (rebuild?.kind !== 'rebuild_table') {
      throw new Error('expected rebuild_table');
    }
    expect(rebuild.preserveExtras).toEqual({ mystery: 'INTEGER' });
    expect(rebuild.copyColumns).not.toContain('gone');
    expect(rebuild.copyColumns).toEqual(
      expect.arrayContaining([
        'id',
        'created_at',
        'updated_at',
        'deleted_at',
        'a',
        'mystery',
      ])
    );
  });

  test('ownership: whole-db drops undeclared tables, declared-only does not', () => {
    const schema = declared([
      defineTable({ domain: 'alpha', name: 'alpha', columns: { a: 'text' } }),
    ]);
    const existing = catalog({
      tables: [table('alpha', 'sqlite', [{ name: 'a', type: 'text' }])],
      allTableNames: ['alpha', 'orphan'],
    });

    const whole = planClient(schema, existing, { ownership: 'whole-db' });
    if (!whole.ok) throw new Error('expected client plan to succeed');
    const drop = whole.operations.find((op) => op.kind === 'drop_table');
    if (drop?.kind !== 'drop_table') throw new Error('expected drop_table');
    expect(String(drop.table)).toBe('orphan');
    expect(
      whole.operations.filter((op) => op.kind === 'drop_table')
    ).toHaveLength(1);

    const scoped = planClient(schema, existing, { ownership: 'declared-only' });
    if (!scoped.ok) throw new Error('expected client plan to succeed');
    expect(scoped.operations.some((op) => op.kind === 'drop_table')).toBe(
      false
    );
  });
});
