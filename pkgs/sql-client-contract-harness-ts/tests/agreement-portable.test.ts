import { describe, expect, test } from 'bun:test';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';
import { canonicalizeRows, stableJson } from './canonical-dump';
import { forEachBackendSample } from './for-each-backend';
import {
  arbRowForTable,
  renderCreateTable,
  renderInsert,
  renderSelectAll,
} from './program';
import {
  MOCKINGBIRD_POSTGRES_FACTORY,
  MOCKINGBIRD_SQLITE_FACTORY,
} from './registry';
import { arbLogicalSchema } from './schema';
import { assertWireSafeRows } from './wire-safety';

const PORTABLE_FACTORIES = [
  MOCKINGBIRD_SQLITE_FACTORY,
  MOCKINGBIRD_POSTGRES_FACTORY,
] as const;

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
