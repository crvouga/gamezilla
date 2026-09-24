import { describe, expect, test } from 'bun:test';
import { assertProperty } from '@pkgs/sim/fast-check';
import fc from 'fast-check';
import { MOCKINGBIRD_POSTGRES_FACTORY, MOCKINGBIRD_SQLITE_FACTORY } from './helpers/backends';
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

const PORTABLE_FACTORIES = [MOCKINGBIRD_SQLITE_FACTORY, MOCKINGBIRD_POSTGRES_FACTORY] as const;

describe('agreement-portable.pbt', () => {
  test('mockingbird-sqlite and mockingbird-postgres agree after type-map + dump codec', async () => {
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
