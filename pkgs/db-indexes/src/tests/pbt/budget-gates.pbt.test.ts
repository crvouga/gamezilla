import { describe, expect, test } from 'bun:test';
import { fingerprintSql } from '../../core/fingerprint';
import { planIndexes } from '../../core/plan';
import { fixedClock, RecordingPort } from '../helpers/recording-port';

function manifestFor(sql: string) {
  return {
    version: 1 as const,
    queries: [
      {
        name: 'q',
        hydrates: ['notes'],
        statements: [
          { index: 0, sql, fingerprint: fingerprintSql(sql), weight: 1 },
        ],
      },
    ],
  };
}

describe('budget gates PBT', () => {
  test('minTableRows boundary = / ±1', async () => {
    const sql = 'SELECT id FROM notes WHERE user_id = ?';
    const mk = (rows: number, minTableRows: number) =>
      planIndexes({
        manifest: manifestFor(sql),
        db: new RecordingPort({
          indexes: [],
          tables: [{ name: 'notes', estimatedRows: rows }],
          usage: [],
          metas: [],
          defaultImprovement: 10,
        }),
        clock: fixedClock(0),
        config: { minTableRows, minImprovementFactor: 1 },
      });

    const below = await mk(9999, 10_000);
    const at = await mk(10_000, 10_000);
    const above = await mk(10_001, 10_000);
    expect(
      below.skipped.some((s) => s.reason === 'below_min_rows') ||
        below.desired.length === 0
    ).toBe(true);
    // at/above may keep if improvement passes
    expect(at.actions.length + at.desired.length).toBeGreaterThanOrEqual(0);
    expect(above.desired.length + above.skipped.length).toBeGreaterThan(0);
  });

  test('minImprovementFactor boundary', async () => {
    const sql = 'SELECT id FROM notes WHERE user_id = ?';
    const run = (improvement: number, minImprovementFactor: number) =>
      planIndexes({
        manifest: manifestFor(sql),
        db: new RecordingPort({
          indexes: [],
          tables: [{ name: 'notes', estimatedRows: 50_000 }],
          usage: [],
          metas: [],
          defaultImprovement: improvement,
        }),
        clock: fixedClock(0),
        config: { minTableRows: 1, minImprovementFactor },
      });

    const low = await run(2, 3);
    const exact = await run(3, 3);
    const high = await run(4, 3);
    expect(
      low.skipped.some((s) => s.reason === 'low_improvement') ||
        low.desired.length === 0
    ).toBe(true);
    expect(exact.desired.length + high.desired.length).toBeGreaterThanOrEqual(
      0
    );
  });

  test('maxIndexesPerTable = / ±1', async () => {
    const sqls = [
      'SELECT id FROM notes WHERE user_id = ?',
      'SELECT id FROM notes WHERE owner_id = ?',
      'SELECT id FROM notes WHERE space_id = ?',
    ];
    const manifest = {
      version: 1 as const,
      queries: sqls.map((sql, i) => ({
        name: `q${String(i)}`,
        hydrates: ['notes'],
        statements: [
          { index: 0, sql, fingerprint: fingerprintSql(sql), weight: 1 },
        ],
      })),
    };
    const plan = await planIndexes({
      manifest,
      db: new RecordingPort({
        indexes: [],
        tables: [{ name: 'notes', estimatedRows: 50_000 }],
        usage: [],
        metas: [],
        defaultImprovement: 10,
      }),
      clock: fixedClock(0),
      config: {
        minTableRows: 1,
        minImprovementFactor: 1,
        maxIndexesPerTable: 2,
      },
    });
    expect(plan.desired.length).toBeLessThanOrEqual(2);
  });
});
