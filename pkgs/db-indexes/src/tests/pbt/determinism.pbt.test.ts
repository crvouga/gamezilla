import { describe, expect, test } from 'bun:test';
import { assertProperty, fc } from '@pkgs/pbt';
import { compareNames } from '../../core/compare';
import { planIndexes } from '../../core/plan';
import { genSchema, genSmallManifest } from '../generators';
import { fixedClock, RecordingPort } from '../helpers/recording-port';

function canonicalizePlan(plan: Awaited<ReturnType<typeof planIndexes>>) {
  return JSON.stringify({
    actions: plan.actions,
    desired: [...plan.desired].map((d) => d.name).sort(compareNames),
    kept: [...plan.kept].sort(compareNames),
    skipped: [...plan.skipped].sort((a, b) => {
      const r = compareNames(a.reason, b.reason);
      if (r !== 0) return r;
      return compareNames(a.detail, b.detail);
    }),
  });
}

describe('analyzer determinism PBT', () => {
  test('same inputs → identical plan JSON', async () => {
    await assertProperty(
      'plan determinism',
      fc.asyncProperty(genSchema, async (schema) => {
        const manifest = await fc.sample(genSmallManifest(schema), 1)[0]!;
        const tables = schema.tables.map((t) => ({
          name: t.name,
          estimatedRows: Math.max(t.estimatedRows, 10_000),
        }));
        const clock = fixedClock(1_700_000_000_000);
        const mk = () =>
          new RecordingPort({
            indexes: [],
            tables,
            usage: [],
            metas: [],
            defaultImprovement: 10,
          });
        const a = await planIndexes({ manifest, db: mk(), clock });
        const b = await planIndexes({ manifest, db: mk(), clock });
        expect(canonicalizePlan(a)).toBe(canonicalizePlan(b));
      }),
      { numRuns: 15 }
    );
  });

  test('shuffled query order → identical after canonicalize', async () => {
    await assertProperty(
      'order independent',
      fc.asyncProperty(genSchema, async (schema) => {
        const base = await fc.sample(genSmallManifest(schema), 1)[0]!;
        if (base.queries.length < 2) return;
        const shuffled = {
          version: 1 as const,
          queries: [...base.queries].reverse(),
        };
        const tables = schema.tables.map((t) => ({
          name: t.name,
          estimatedRows: Math.max(t.estimatedRows, 10_000),
        }));
        const clock = fixedClock(1_700_000_000_000);
        const mk = () =>
          new RecordingPort({
            indexes: [],
            tables,
            usage: [],
            metas: [],
            defaultImprovement: 10,
          });
        const a = await planIndexes({ manifest: base, db: mk(), clock });
        const b = await planIndexes({
          manifest: shuffled,
          db: mk(),
          clock,
        });
        expect(canonicalizePlan(a)).toBe(canonicalizePlan(b));
      }),
      { numRuns: 10 }
    );
  });

  test('introspect name order does not affect plan', async () => {
    const { fingerprintSql } = await import('../../core/fingerprint');
    const sql = 'SELECT id FROM notes WHERE user_id = ?';
    const manifest = {
      version: 1 as const,
      queries: [
        {
          name: 'q',
          hydrates: ['notes'],
          statements: [
            {
              index: 0,
              sql,
              fingerprint: fingerprintSql(sql),
              weight: 1,
            },
          ],
        },
      ],
    };
    const tables = [{ name: 'notes', estimatedRows: 50_000 }];
    const clock = fixedClock(0);
    const a = await planIndexes({
      manifest,
      db: new RecordingPort({
        indexes: [],
        tables,
        usage: [],
        metas: [],
        defaultImprovement: 10,
      }),
      clock,
    });
    const b = await planIndexes({
      manifest,
      db: new RecordingPort({
        indexes: [],
        tables: [...tables].reverse(),
        usage: [],
        metas: [],
        defaultImprovement: 10,
      }),
      clock,
    });
    expect(canonicalizePlan(a)).toBe(canonicalizePlan(b));
  });
});
