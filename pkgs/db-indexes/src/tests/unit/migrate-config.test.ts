import { describe, expect, test } from 'bun:test';
import { MIGRATE_RECONCILE_CONFIG } from '../../core/config';
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

describe('MIGRATE_RECONCILE_CONFIG', () => {
  test('keeps candidates on 0-row tables', async () => {
    const plan = await planIndexes({
      manifest: manifestFor('SELECT id FROM notes WHERE user_id = ?'),
      db: new RecordingPort({
        indexes: [],
        tables: [{ name: 'notes', estimatedRows: 0 }],
        usage: [],
        metas: [],
        defaultImprovement: 1,
      }),
      clock: fixedClock(0),
      config: MIGRATE_RECONCILE_CONFIG,
    });
    expect(plan.skipped.some((s) => s.reason === 'below_min_rows')).toBe(false);
    expect(plan.desired.length).toBeGreaterThan(0);
    expect(plan.actions.some((a) => a.kind === 'create')).toBe(true);
  });

  test('does not skip low_improvement', async () => {
    const plan = await planIndexes({
      manifest: manifestFor('SELECT id FROM notes WHERE user_id = ?'),
      db: new RecordingPort({
        indexes: [],
        tables: [{ name: 'notes', estimatedRows: 50_000 }],
        usage: [],
        metas: [],
        defaultImprovement: 1,
      }),
      clock: fixedClock(0),
      config: MIGRATE_RECONCILE_CONFIG,
    });
    expect(plan.skipped.some((s) => s.reason === 'low_improvement')).toBe(
      false
    );
    expect(plan.desired.length).toBeGreaterThan(0);
  });
});
