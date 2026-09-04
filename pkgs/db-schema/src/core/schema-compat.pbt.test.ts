import { describe, expect, test } from 'bun:test';
import { assertProperty } from '@pkgs/dst/fast-check';
import fc from 'fast-check';
import { emptyCatalog, tableWithColumns } from '../test/fixtures';
import { classifyDelta } from './compatibility';
import { sealSchema, validateRuntime } from './define-schema';
import { POSTGRES_CAPS, SQLITE_CAPS } from './dialect-caps';
import { planClient, planServer } from './plan';
import { SQLITE_TYPE_SQL } from './type-map';
import type { ColumnType, IntrospectedCatalog, Schema } from './types';
import { COLUMN_TYPES } from './types';

const columnTypeArb = fc.constantFrom(...COLUMN_TYPES);
const colNameArb = fc.constantFrom('a', 'b', 'c', 'd', 'body', 'title', 'n');

function schemaFromCols(
  cols: Record<string, ColumnType>,
  deprecations?: readonly (readonly [string, string, string])[]
): Schema {
  return sealSchema(
    validateRuntime({
      tables: { notes: cols },
      ...(deprecations !== undefined ? { deprecations } : {}),
    })
  );
}

function catalogMatching(
  cols: Record<string, ColumnType>,
  mode: 'postgres' | 'sqlite',
  extras: { name: string; type: string }[] = []
): IntrospectedCatalog {
  const columns = [
    {
      name: 'id',
      type: mode === 'sqlite' ? 'TEXT' : 'text',
      nullable: false,
      isPrimaryKey: true,
    },
    {
      name: 'created_at',
      type: mode === 'sqlite' ? 'TEXT' : 'timestamp',
    },
    {
      name: 'updated_at',
      type: mode === 'sqlite' ? 'TEXT' : 'timestamp',
    },
    {
      name: 'deleted_at',
      type: mode === 'sqlite' ? 'TEXT' : 'timestamp',
    },
    ...Object.entries(cols).map(([name, type]) => ({
      name,
      type: mode === 'sqlite' ? SQLITE_TYPE_SQL[type] : type,
    })),
    ...extras,
  ];
  return {
    tables: new Map([['notes', tableWithColumns('notes', columns)]]),
    indexes: [],
    allTableNames: new Set(['notes']),
  };
}

describe('db-schema compatibility PBT', () => {
  test('snapshot is deterministic for identical schemas', () => {
    assertProperty(
      'snapshot freeze + sort',
      fc.property(
        fc.uniqueArray(colNameArb, { minLength: 1, maxLength: 4 }),
        columnTypeArb,
        (names, type) => {
          const cols: Record<string, ColumnType> = {};
          for (const n of names) cols[n] = type;
          const a = schemaFromCols(cols);
          const b = schemaFromCols(cols);
          expect(JSON.stringify(a.snapshot())).toBe(
            JSON.stringify(b.snapshot())
          );
          expect(Object.isFrozen(a._declared)).toBe(true);
        }
      )
    );
  });

  test('compatible additive delta never drift-fails on either dialect', () => {
    assertProperty(
      'additive column is ok',
      fc.property(columnTypeArb, (type) => {
        const v1 = schemaFromCols({ body: 'text' });
        const v2 = schemaFromCols({ body: 'text', extra: type });
        const catalog = catalogMatching({ body: 'text' }, 'postgres');
        const server = planServer(v2._declared, catalog);
        expect(server.ok).toBe(true);
        const client = planClient(
          v2._declared,
          catalogMatching({ body: 'text' }, 'sqlite')
        );
        expect(client.ok).toBe(true);
        void v1;
      })
    );
  });

  test('forbidden extra column fails on both dialects', () => {
    assertProperty(
      'extra without deprecation',
      fc.property(fc.constantFrom('ghost', 'legacy', 'tmp_col'), (extra) => {
        const schema = schemaFromCols({ body: 'text' });
        const pg = classifyDelta({
          declared: schema._declared,
          catalog: catalogMatching({ body: 'text' }, 'postgres', [
            { name: extra, type: 'text' },
          ]),
          caps: POSTGRES_CAPS,
          mode: 'postgres',
        });
        expect(pg.drift.length).toBeGreaterThan(0);
        const lite = classifyDelta({
          declared: schema._declared,
          catalog: catalogMatching({ body: 'text' }, 'sqlite', [
            { name: extra, type: 'TEXT' },
          ]),
          caps: SQLITE_CAPS,
          mode: 'sqlite',
        });
        expect(lite.drift.length).toBeGreaterThan(0);
      })
    );
  });

  test('deprecated extra is ok on postgres; contract_client on sqlite', () => {
    assertProperty(
      'deprecated leftover',
      fc.property(fc.constantFrom('old_a', 'old_b'), (extra) => {
        const schema = schemaFromCols({ body: 'text' }, [
          ['notes', extra, 'unused'],
        ]);
        const pg = classifyDelta({
          declared: schema._declared,
          catalog: catalogMatching({ body: 'text' }, 'postgres', [
            { name: extra, type: 'text' },
          ]),
          caps: POSTGRES_CAPS,
          mode: 'postgres',
        });
        expect(pg.drift.length).toBe(0);
        expect(pg.deprecatedExtras.length).toBe(1);
        const lite = classifyDelta({
          declared: schema._declared,
          catalog: catalogMatching({ body: 'text' }, 'sqlite', [
            { name: extra, type: 'TEXT' },
          ]),
          caps: SQLITE_CAPS,
          mode: 'sqlite',
        });
        expect(lite.drift.length).toBe(0);
        expect(
          lite.columnDeltas.some((d) => d.kind === 'contract_client')
        ).toBe(true);
      })
    );
  });

  test('fresh plan on empty catalog is create_table only for server', () => {
    assertProperty(
      'empty → create',
      fc.property(
        fc.uniqueArray(colNameArb, { minLength: 1, maxLength: 3 }),
        columnTypeArb,
        (names, type) => {
          const cols: Record<string, ColumnType> = {};
          for (const n of names) cols[n] = type;
          const schema = schemaFromCols(cols);
          const plan = planServer(schema._declared, emptyCatalog());
          expect(plan.ok).toBe(true);
          if (!plan.ok) return;
          expect(plan.operations.some((o) => o.kind === 'create_table')).toBe(
            true
          );
          expect(
            plan.operations.every(
              (o) =>
                o.kind === 'create_table' ||
                o.kind === 'create_index' ||
                o.kind === 'create_view' ||
                o.kind === 'create_enum' ||
                o.kind === 'add_check' ||
                o.kind === 'add_foreign_key'
            )
          ).toBe(true);
        }
      )
    );
  });
});
