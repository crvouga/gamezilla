import { expect, test } from 'bun:test';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import sql from '@pkgs/sql-root-shared-ts/sql';
import fc from 'fast-check';
import { conflictHost } from './mutation-conflict-fixture';

test('conflict schedules never expose a partial batch or duplicate a committed save', async () => {
  await assertProperty(
    'mutation-conflict-recovery-atomicity',
    fc.asyncProperty(
      fc.array(fc.constantFrom('40001', '40P01'), { maxLength: 7 }),
      async (codes) => {
        const failures = codes.map((code) =>
          Object.assign(new Error('transaction conflict'), { code })
        );
        const host = await conflictHost(failures);
        try {
          const response = await host.post();
          const saved = response.status === 200;
          expect(saved).toBe(codes.length < 6);
          const applied = await host.db.query(
            sql<{
              mutation_id: string;
            }>`SELECT mutation_id FROM sync_engine_mutations_applied`
          );
          const events = await host.db.query(
            sql<{
              mutation_id: string;
            }>`SELECT mutation_id FROM sync_engine_observability_events`
          );
          expect(applied).toEqual(saved ? [{ mutation_id: 'save-1' }] : []);
          expect(events).toEqual(applied);
          expect(host.committed()).toBe(saved ? 1 : 0);
        } finally {
          await host.db.disconnect();
        }
      }
    )
  );
});
