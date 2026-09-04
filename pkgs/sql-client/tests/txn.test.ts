import './_shared-teardown';
import { describe, expect, test } from 'bun:test';
import { assertProperty } from '@pkgs/sim/fast-check';
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
import { assertWireSafeRows } from './helpers/oracles/wire-safety';

describe('txn.pbt', () => {
  test('rollback restores prior dump; commit is visible', async () => {
    await assertProperty(
      'transaction rollback/commit',
      fc.asyncProperty(
        arbLogicalSchema().chain((schema) => {
          const table = schema.tables[0]!;
          return fc
            .tuple(arbRowForTable(table), arbRowForTable(table))
            .map(([keep, rolled]) => ({ schema, table, keep, rolled }));
        }),
        async ({ schema, table, keep, rolled }) => {
          await forEachBackendSample(
            ALWAYS_FACTORIES,
            schema,
            async (backend) => {
              await backend.client.run(
                renderCreateTable(backend.dialect, table)
              );
              await backend.client.run(renderInsert(table, keep));
              try {
                await backend.client.transaction(async (tx) => {
                  await tx.run(renderInsert(table, rolled));
                  throw new Error('rollback');
                });
              } catch (err: unknown) {
                if (!(err instanceof Error) || err.message !== 'rollback') {
                  throw err;
                }
              }
              const afterRollback = await backend.client.query(
                renderSelectAll(table)
              );
              assertWireSafeRows(afterRollback, `${backend.name}:rollback`);
              expect(afterRollback.length).toBe(1);
              expect(String(afterRollback[0]?.['id'])).toBe(String(keep['id']));

              await backend.client.transaction(async (tx) => {
                await tx.run(renderInsert(table, rolled));
              });
              const afterCommit = await backend.client.query(
                renderSelectAll(table)
              );
              assertWireSafeRows(afterCommit, `${backend.name}:commit`);
              expect(afterCommit.length).toBe(2);
            }
          );
        }
      ),
      { numRuns: 15 }
    );
  }, 180_000);
});
