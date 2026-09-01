import './_shared-teardown';
import { describe, expect, test } from 'bun:test';
import { assertProperty, fc } from '@pkgs/pbt';
import { PGLITE_FACTORY, POSTGRES_MEM_FACTORY } from '../backends';
import { arbLogicalSchema, arbProgram } from '../generators';
import { forEachBackendSample } from '../helpers/for-each-backend';
import { runProgramOnBackend } from '../helpers/run-program';
import { canonicalizeRows, stableJson } from '../oracles/canonical-dump';

const PG_FACTORIES = [POSTGRES_MEM_FACTORY, PGLITE_FACTORY] as const;

describe('agreement-postgres.pbt', () => {
  test('postgres-mem and pglite agree on canonical dumps', async () => {
    await assertProperty(
      'postgres intra-dialect agreement',
      fc.asyncProperty(
        arbLogicalSchema().chain((schema) =>
          arbProgram(schema).map((steps) => ({ schema, steps }))
        ),
        async ({ schema, steps }) => {
          const dumps: string[] = [];
          await forEachBackendSample(PG_FACTORIES, schema, async (backend) => {
            const result = await runProgramOnBackend(backend, schema, steps);
            const table = schema.tables[0]!;
            dumps.push(
              stableJson(canonicalizeRows(result.lastSelect, table.columns))
            );
          });
          expect(dumps[0]).toBe(dumps[1]);
        }
      ),
      { numRuns: 20 }
    );
  }, 180_000);
});
