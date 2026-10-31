import { expect, test } from 'bun:test';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import {
  hashQueryTables,
  sha256Hex,
} from '@pkgs/sync-engine-shared-ts/canonical';
import { sqliteWireValue } from '@pkgs/sync-engine-shared-ts/sqlite-wire-value';
import fc from 'fast-check';

/** Independent pre-instrumentation wire format oracle; never change to accept a new hash. */
function originalHash(tables: Record<string, Record<string, unknown>[]>) {
  const parts = ['hqtv2'];
  for (const table of Object.keys(tables).sort()) {
    const rows = [...tables[table]!].sort((a, b) => {
      const left = String(a['id'] ?? '');
      const right = String(b['id'] ?? '');
      return left < right ? -1 : left > right ? 1 : 0;
    });
    parts.push(table, String(rows.length));
    for (const row of rows) {
      const stored = Object.create(null) as Record<string, string | null>;
      for (const key of Object.keys(row).sort()) {
        if (row[key] === undefined) continue;
        const value = sqliteWireValue(row[key]);
        stored[key] = value === null ? null : String(value);
      }
      parts.push(JSON.stringify(stored));
    }
  }
  return sha256Hex(parts.join('\0'));
}

test('instrumented hashing preserves the wire format without mutating rows', async () => {
  await assertProperty(
    'instrumented hashes retain their exact wire representation',
    fc.asyncProperty(
      fc.array(fc.record({ id: fc.string(), value: fc.jsonValue() }), {
        maxLength: 40,
      }),
      async (rows) => {
        const before = JSON.stringify(rows);
        const tables = { notes: rows };
        expect(hashQueryTables(tables)).toBe(originalHash(tables));
        expect(JSON.stringify(rows)).toBe(before);
      }
    )
  );
});
