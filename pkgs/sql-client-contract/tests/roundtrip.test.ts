import { describe, expect, test } from 'bun:test';
import { assertProperty } from '@pkgs/property';
import fc from 'fast-check';
import { ALWAYS_FACTORIES } from './helpers/backends';
import { forEachBackendSample } from './helpers/for-each-backend';
import {
  arbLogicalSchema,
  arbRowForTable,
  renderCreateTable,
  renderInsert,
  renderSelectAll,
} from './helpers/generators';
import { canonicalizeRows, stableJson } from './helpers/oracles/canonical-dump';
import { assertWireSafeRows } from './helpers/oracles/wire-safety';

describe('roundtrip.pbt', () => {
  test('insert then select matches canonical dump of bound row', async () => {
    await assertProperty(
      'roundtrip insert/select',
      fc.asyncProperty(
        arbLogicalSchema().chain((schema) => {
          const table = schema.tables[0]!;
          return arbRowForTable(table).map((row) => ({ schema, table, row }));
        }),
        async ({ schema, table, row }) => {
          await forEachBackendSample(
            ALWAYS_FACTORIES,
            schema,
            async (backend) => {
              await backend.client.run(
                renderCreateTable(backend.dialect, table)
              );
              await backend.client.run(renderInsert(table, row));
              const rows = await backend.client.query(renderSelectAll(table));
              assertWireSafeRows(rows, `${backend.name}:roundtrip`);
              expect(rows.length).toBe(1);
              const got = canonicalizeRows(rows, table.columns);
              const expected = canonicalizeRows([row], table.columns);
              expect(stableJson(got)).toBe(stableJson(expected));
            }
          );
        }
      ),
      { numRuns: 25 }
    );
  }, 180_000);
});
