import './_shared-teardown';
import { describe, expect, test } from 'bun:test';
import { assertProperty, fc } from '@pkgs/pbt';
import { sql } from '@pkgs/sql';
import { ALWAYS_FACTORIES, openBackend } from '../backends';
import { assertWireSafeRows } from '../oracles/wire-safety';

describe('json1.pbt', () => {
  test('json_extract / json_valid work on every default backend', async () => {
    await assertProperty(
      'json1 extract/valid',
      fc.asyncProperty(
        fc.record({
          a: fc.integer({ min: -1000, max: 1000 }),
          label: fc.stringMatching(/^[a-z]{1,8}$/),
        }),
        async (payload) => {
          const jsonText = JSON.stringify(payload);
          for (const factory of ALWAYS_FACTORIES) {
            const backend = await openBackend(factory);
            try {
              const extracted = await backend.client.query<{
                v: string | number | null;
              }>(sql`
                SELECT json_extract(${jsonText}, ${'$.a'}) AS v
              `);
              assertWireSafeRows(extracted, `${backend.name}:json_extract`);
              expect(Number(extracted[0]?.v)).toBe(payload.a);

              const valid = await backend.client.query<{
                ok: number | boolean | null;
              }>(sql`
                SELECT json_valid(${jsonText}) AS ok
              `);
              assertWireSafeRows(valid, `${backend.name}:json_valid`);
              const ok = valid[0]?.ok;
              expect(ok === true || ok === 1).toBe(true);
            } finally {
              await backend.close();
            }
          }
        }
      ),
      { numRuns: 25 }
    );
  }, 180_000);
});
