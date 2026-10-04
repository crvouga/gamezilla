import { describe, expect, test } from 'bun:test';
import type { SchemaViolation } from '@pkgs/db-schema-shared/schema-evolution';
import type { Snapshot } from '@pkgs/db-schema-shared/types';
import { assertEvolvable, diffSnapshots } from '@pkgs/db-schema-shared/schema-evolution';
import { defineTable } from '@pkgs/db-schema-shared/define-table';
import { registerTables } from '@pkgs/db-schema-shared/register-tables';

function snap(input: Partial<Snapshot>): Snapshot {
  return {
    tables: {},
    retiredColumns: {},
    physicalOverrides: {},
    retiredTables: [],
    indexes: [],
    uniqueIndexes: [],
    ...input,
  };
}

function ruleNames(violations: readonly SchemaViolation[]): string[] {
  return violations.map((v) => v.rule);
}

describe('diffSnapshots / assertEvolvable over hand-built snapshots', () => {
  test('removing a table without a tombstone is fatal; with one it passes', () => {
    const prev = snap({ tables: { alpha: { a: 'text' } } });

    const removed = diffSnapshots(prev, snap({}));
    expect(ruleNames(removed)).toEqual(['table-removed']);
    expect(removed[0]!.severity).toBe('fatal');
    expect(removed[0]!.path).toBe('alpha');
    expect(() => assertEvolvable(prev, snap({}))).toThrow(/table-removed/);

    const tombstoned = snap({
      retiredTables: [{ name: 'alpha', note: 'old clients read alpha' }],
    });
    expect(diffSnapshots(prev, tombstoned)).toEqual([]);
  });

  test('removing a column without a tombstone is fatal; with one it passes', () => {
    const prev = snap({ tables: { alpha: { a: 'text', b: 'text' } } });

    const removed = diffSnapshots(
      prev,
      snap({ tables: { alpha: { a: 'text' } } })
    );
    expect(ruleNames(removed)).toEqual(['column-removed']);
    expect(removed[0]!.severity).toBe('fatal');
    expect(removed[0]!.path).toBe('alpha.b');

    const tombstoned = snap({
      tables: { alpha: { a: 'text' } },
      retiredColumns: {
        alpha: { b: { type: 'text', note: 'old clients read b' } },
      },
    });
    expect(diffSnapshots(prev, tombstoned)).toEqual([]);
  });

  test('changing a declared column logical type is fatal', () => {
    const prev = snap({ tables: { alpha: { a: 'text' } } });
    const next = snap({ tables: { alpha: { a: 'integer' } } });

    const violations = diffSnapshots(prev, next);
    expect(ruleNames(violations)).toEqual(['column-type-changed']);
    expect(violations[0]!.severity).toBe('fatal');
    expect(violations[0]!.path).toBe('alpha.a');
    expect(() => assertEvolvable(prev, next)).toThrow(/column-type-changed/);
  });

  test("changing a tombstone's frozen type is fatal", () => {
    const prev = snap({
      tables: { alpha: { a: 'text' } },
      retiredColumns: { alpha: { b: { type: 'text', note: 'frozen b' } } },
    });
    const next = snap({
      tables: { alpha: { a: 'text' } },
      retiredColumns: { alpha: { b: { type: 'integer', note: 'frozen b' } } },
    });

    const violations = diffSnapshots(prev, next);
    expect(ruleNames(violations)).toEqual(['retired-column-type-changed']);
    expect(violations[0]!.severity).toBe('fatal');
    expect(violations[0]!.path).toBe('alpha.b');
  });

  test('deleting a pre-existing tombstone is fatal (column and table forms)', () => {
    const prevColumn = snap({
      tables: { alpha: { a: 'text' } },
      retiredColumns: { alpha: { b: { type: 'text', note: 'b' } } },
    });
    const columnRemoved = diffSnapshots(
      prevColumn,
      snap({ tables: { alpha: { a: 'text' } } })
    );
    expect(ruleNames(columnRemoved)).toEqual(['retired-entry-removed']);
    expect(columnRemoved[0]!.severity).toBe('fatal');
    expect(columnRemoved[0]!.path).toBe('alpha.b');

    const prevTable = snap({
      tables: { alpha: { a: 'text' } },
      retiredTables: [{ name: 'beta', note: 'beta' }],
    });
    const tableRemoved = diffSnapshots(
      prevTable,
      snap({ tables: { alpha: { a: 'text' } } })
    );
    expect(ruleNames(tableRemoved)).toEqual(['retired-entry-removed']);
    expect(tableRemoved[0]!.severity).toBe('fatal');
    expect(tableRemoved[0]!.path).toBe('beta');
  });

  test('a new unique index is a warning, not a refusal', () => {
    const prev = snap({ tables: { alpha: { a: 'text' } } });
    const next = snap({
      tables: { alpha: { a: 'text' } },
      uniqueIndexes: [['alpha', 'a']],
    });

    const violations = diffSnapshots(prev, next);
    expect(ruleNames(violations)).toEqual(['unique-index-added']);
    expect(violations[0]!.severity).toBe('warning');

    const warnings = assertEvolvable(prev, next);
    expect(ruleNames(warnings)).toEqual(['unique-index-added']);
  });

  test('gaining a physical override is a warning, not a refusal', () => {
    const prev = snap({ tables: { alpha: { a: 'text' } } });
    const next = snap({
      tables: { alpha: { a: 'text' } },
      physicalOverrides: { alpha: { a: { postgres: 'varchar' } } },
    });

    const violations = diffSnapshots(prev, next);
    expect(ruleNames(violations)).toEqual(['physical-override-added']);
    expect(violations[0]!.severity).toBe('warning');

    const warnings = assertEvolvable(prev, next);
    expect(ruleNames(warnings)).toEqual(['physical-override-added']);
  });

  test('an identical snapshot throws nothing and returns no warnings', () => {
    const same = snap({
      tables: { alpha: { a: 'text' } },
      retiredColumns: { alpha: { b: { type: 'text', note: 'b' } } },
      retiredTables: [{ name: 'beta', note: 'beta' }],
      uniqueIndexes: [['alpha', 'a']],
      physicalOverrides: { alpha: { a: { postgres: 'varchar' } } },
    });

    expect(() => assertEvolvable(same, same)).not.toThrow();
    expect(assertEvolvable(same, same)).toEqual([]);
  });

  test('several fatal problems are all reported in one throw', () => {
    const prev = snap({ tables: { alpha: { a: 'text', b: 'text' } } });
    const next = snap({ tables: { alpha: { a: 'integer' } } });

    const rules = new Set(ruleNames(diffSnapshots(prev, next)));
    expect(rules).toEqual(new Set(['column-removed', 'column-type-changed']));

    expect(() => assertEvolvable(prev, next)).toThrow(/column-removed/);
    expect(() => assertEvolvable(prev, next)).toThrow(/column-type-changed/);
  });
});

describe('diffSnapshots / assertEvolvable over registerTables schemas', () => {
  test('table removal: fatal without a retiredTables entry, clean with one', () => {
    const prev = registerTables([
      defineTable({ domain: 'alpha', name: 'alpha', columns: { a: 'text' } }),
      defineTable({ domain: 'beta', name: 'beta', columns: { b: 'text' } }),
    ]);
    const dropped = registerTables([
      defineTable({ domain: 'alpha', name: 'alpha', columns: { a: 'text' } }),
    ]);

    const violations = diffSnapshots(prev.snapshot(), dropped.snapshot());
    expect(ruleNames(violations)).toEqual(['table-removed']);
    expect(() => assertEvolvable(prev.snapshot(), dropped.snapshot())).toThrow(
      /table-removed/
    );

    const tombstoned = registerTables(
      [defineTable({ domain: 'alpha', name: 'alpha', columns: { a: 'text' } })],
      {
        retiredTables: [
          { domain: 'beta', name: 'beta', note: 'old clients read beta' },
        ],
      }
    );
    expect(diffSnapshots(prev.snapshot(), tombstoned.snapshot())).toEqual([]);
  });

  test('column removal: fatal without a retiredColumns entry, clean with one', () => {
    const prev = registerTables([
      defineTable({
        domain: 'alpha',
        name: 'alpha',
        columns: { a: 'text', b: 'text' },
      }),
    ]);
    const dropped = registerTables([
      defineTable({ domain: 'alpha', name: 'alpha', columns: { a: 'text' } }),
    ]);

    const violations = diffSnapshots(prev.snapshot(), dropped.snapshot());
    expect(ruleNames(violations)).toEqual(['column-removed']);
    expect(violations[0]!.path).toBe('alpha.b');

    const tombstoned = registerTables([
      defineTable({
        domain: 'alpha',
        name: 'alpha',
        columns: { a: 'text' },
        retiredColumns: [
          { name: 'b', type: 'text', note: 'old clients read b' },
        ],
      }),
    ]);
    expect(diffSnapshots(prev.snapshot(), tombstoned.snapshot())).toEqual([]);
  });

  test('column removal with a mismatched tombstone type is fatal', () => {
    const prev = registerTables([
      defineTable({
        domain: 'alpha',
        name: 'alpha',
        columns: { a: 'text', b: 'text' },
      }),
    ]);
    const wrongTombstone = registerTables([
      defineTable({
        domain: 'alpha',
        name: 'alpha',
        columns: { a: 'text' },
        retiredColumns: [
          { name: 'b', type: 'integer', note: 'wrong frozen type' },
        ],
      }),
    ]);

    const violations = diffSnapshots(
      prev.snapshot(),
      wrongTombstone.snapshot()
    );
    expect(ruleNames(violations)).toEqual(['retired-column-type-changed']);
    expect(() =>
      assertEvolvable(prev.snapshot(), wrongTombstone.snapshot())
    ).toThrow(/retired-column-type-changed/);
  });
});
