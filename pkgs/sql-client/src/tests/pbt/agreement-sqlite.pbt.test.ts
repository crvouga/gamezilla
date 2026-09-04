import './_shared-teardown';
import { describe, expect, test } from 'bun:test';
import { assertProperty } from '@pkgs/dst/fast-check';
import fc from 'fast-check';
import { BUN_SQLITE_FACTORY, SQLITE_MEM_FACTORY } from '../backends';
import { arbLogicalSchema, arbProgram } from '../generators';
import { forEachBackendSample } from '../helpers/for-each-backend';
import { runProgramOnBackend } from '../helpers/run-program';
import { canonicalizeRows, stableJson } from '../oracles/canonical-dump';

const SQLITE_FACTORIES = [SQLITE_MEM_FACTORY, BUN_SQLITE_FACTORY] as const;

describe('agreement-sqlite.pbt', () => {
  test('sqlite-mem and bun-sqlite agree on canonical dumps', async () => {
    await assertProperty(
      'sqlite intra-dialect agreement',
      fc.asyncProperty(
        arbLogicalSchema().chain((schema) =>
          arbProgram(schema).map((steps) => ({ schema, steps }))
        ),
        async ({ schema, steps }) => {
          const dumps: string[] = [];
          await forEachBackendSample(
            SQLITE_FACTORIES,
            schema,
            async (backend) => {
              const result = await runProgramOnBackend(backend, schema, steps);
              const table = schema.tables[0]!;
              dumps.push(
                stableJson(canonicalizeRows(result.lastSelect, table.columns))
              );
            }
          );
          expect(dumps[0]).toBe(dumps[1]);
        }
      ),
      { numRuns: 30 }
    );
  }, 120_000);
});
