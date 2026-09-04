import './_shared-teardown';
import { describe, test } from 'bun:test';
import { assertProperty } from '@pkgs/dst/fast-check';
import fc from 'fast-check';
import { ALWAYS_FACTORIES } from '../backends';
import { arbLogicalSchema, arbProgram } from '../generators';
import { forEachBackendSample } from '../helpers/for-each-backend';
import { runProgramOnBackend } from '../helpers/run-program';

describe('wire-safety.pbt', () => {
  test('every default backend returns JSON-safe bigint-free rows', async () => {
    await assertProperty(
      'wire-safety across default backends',
      fc.asyncProperty(
        arbLogicalSchema().chain((schema) =>
          arbProgram(schema).map((steps) => ({ schema, steps }))
        ),
        async ({ schema, steps }) => {
          await forEachBackendSample(
            ALWAYS_FACTORIES,
            schema,
            async (backend) => {
              await runProgramOnBackend(backend, schema, steps);
            }
          );
        }
      ),
      { numRuns: 20 }
    );
  }, 180_000);
});
