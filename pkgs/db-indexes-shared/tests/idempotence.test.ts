import { describe, expect, test } from 'bun:test';
import { assertProperty } from '@pkgs/property-shared/assert-property';
import fc from 'fast-check';
import { planIndexes } from '@pkgs/db-indexes-shared/plan';
import { reconcileIndexes } from '@pkgs/db-indexes-shared/reconcile';
import { genSchemaWithManifest } from './manifest';
import { fixedClock, RecordingPort } from './recording-port';

describe('analyzer idempotence PBT', () => {
  test('apply creates → re-plan → empty actions', async () => {
    await assertProperty(
      'idempotence',
      fc.asyncProperty(genSchemaWithManifest, async ({ schema, manifest }) => {
        const tables = schema.tables.map((t) => ({
          name: t.name,
          estimatedRows: Math.max(t.estimatedRows, 10_000),
        }));
        const clock = fixedClock(1_700_000_000_000);
        const db = new RecordingPort(
          {
            indexes: [],
            tables,
            usage: [],
            metas: [],
            defaultImprovement: 10,
          },
          { mutable: true }
        );
        await reconcileIndexes({
          manifest,
          db,
          clock,
          deadlineMs: 60_000,
          config: {
            minTableRows: 1,
            createEstimatedMs: 1,
            dropEstimatedMs: 1,
            metaEstimatedMs: 1,
            maxBuildsPerRun: 50,
          },
        });
        const plan = await planIndexes({
          manifest,
          db,
          clock,
          config: { minTableRows: 1 },
        });
        const creates = plan.actions.filter((a) => a.kind === 'create');
        expect(creates.length).toBe(0);
      }),
      { numRuns: 12 }
    );
  });
});
