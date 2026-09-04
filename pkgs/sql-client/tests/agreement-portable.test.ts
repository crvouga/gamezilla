import './_shared-teardown';
import { describe, expect, test } from 'bun:test';
import { assertProperty } from '@pkgs/dst/fast-check';
import fc from 'fast-check';
import { POSTGRES_MEM_FACTORY, SQLITE_MEM_FACTORY } from '../backends';
import {
  arbLogicalSchema,
  arbRowForTable,
  renderCreateTable,
  renderInsert,
  renderSelectAll,
} from '../generators';
import { forEachBackendSample } from '../helpers/for-each-backend';
import { canonicalizeRows, stableJson } from '../oracles/canonical-dump';
import { assertWireSafeRows } from '../oracles/wire-safety';

const PORTABLE_FACTORIES = [SQLITE_MEM_FACTORY, POSTGRES_MEM_FACTORY] as const;

describe('agreement-portable.pbt', () => {
  test('sqlite-mem and postgres-mem agree after type-map + dump codec', async () => {
    await assertProperty(
      'portable cross-dialect agreement',
      fc.asyncProperty(
        arbLogicalSchema().chain((schema) => {
          const table = schema.tables[0]!;
          return arbRowForTable(table).map((row) => ({ schema, table, row }));
        }),
        async ({ schema, table, row }) => {
          const dumps: string[] = [];
          await forEachBackendSample(
            PORTABLE_FACTORIES,
            schema,
            async (backend) => {
              await backend.client.run(
                renderCreateTable(backend.dialect, table)
              );
              await backend.client.run(renderInsert(table, row));
              const rows = await backend.client.query(renderSelectAll(table));
              assertWireSafeRows(rows, `${backend.name}:portable`);
              dumps.push(stableJson(canonicalizeRows(rows, table.columns)));
            }
          );
          expect(dumps[0]).toBe(dumps[1]);
        }
      ),
      { numRuns: 40 }
    );
  }, 120_000);
});
