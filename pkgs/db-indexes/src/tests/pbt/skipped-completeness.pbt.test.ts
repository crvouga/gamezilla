import { describe, expect, test } from 'bun:test';
import { assertProperty } from '@pkgs/dst/fast-check';
import fc from 'fast-check';
import { planIndexes } from '../../core/plan';
import type { SkipReason } from '../../core/types';
import { genSchema, genSmallManifest } from '../generators';
import { fixedClock, RecordingPort } from '../helpers/recording-port';

const KNOWN = new Set<SkipReason>([
  'parse_failed',
  'missing_table',
  'low_improvement',
  'below_min_rows',
  'over_budget',
  'pk_only',
  'empty_key',
  'unsupported',
  'zero_statements',
  'fingerprint_divergence',
]);

describe('skipped completeness PBT', () => {
  test('every statement path yields kept / covered / skipped; never throws past boundary', async () => {
    await assertProperty(
      'skipped',
      fc.asyncProperty(genSchema, async (schema) => {
        const manifest = await fc.sample(genSmallManifest(schema), 1)[0]!;
        // Drop first table from introspect to force missing_table sometimes
        const tables = schema.tables.slice(1).map((t) => ({
          name: t.name,
          estimatedRows: Math.max(t.estimatedRows, 10_000),
        }));
        if (tables.length === 0) {
          tables.push({
            name: schema.tables[0]!.name,
            estimatedRows: 50_000,
          });
        }
        const db = new RecordingPort({
          indexes: [],
          tables,
          usage: [],
          metas: [],
          defaultImprovement: 1,
        });
        const plan = await planIndexes({
          manifest,
          db,
          clock: fixedClock(0),
          config: { minTableRows: 1, minImprovementFactor: 3 },
        });
        for (const s of plan.skipped) {
          expect(KNOWN.has(s.reason)).toBe(true);
        }
        // Plan always returns without throw
        expect(plan.actions).toBeDefined();
      }),
      { numRuns: 15 }
    );
  });

  test('unparseable SQL becomes skipped, not throw', async () => {
    const { fingerprintSql } = await import('../../core/fingerprint');
    const sql = 'NOT SQL AT ALL !!!';
    const plan = await planIndexes({
      manifest: {
        version: 1,
        queries: [
          {
            name: 'bad',
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
      },
      db: new RecordingPort({
        indexes: [],
        tables: [{ name: 'notes', estimatedRows: 50_000 }],
        usage: [],
        metas: [],
      }),
      clock: fixedClock(0),
      config: { minTableRows: 1 },
    });
    expect(plan.skipped.length).toBeGreaterThan(0);
  });

  test('stale fingerprint is skipped, not throw', async () => {
    const plan = await planIndexes({
      manifest: {
        version: 1,
        queries: [
          {
            name: 'bad',
            hydrates: ['notes'],
            statements: [
              {
                index: 0,
                sql: 'SELECT id FROM notes WHERE user_id = ?',
                fingerprint: 'deadbeef',
                weight: 1,
              },
            ],
          },
        ],
      },
      db: new RecordingPort({
        indexes: [],
        tables: [{ name: 'notes', estimatedRows: 50_000 }],
        usage: [],
        metas: [],
      }),
      clock: fixedClock(0),
      config: { minTableRows: 1 },
    });
    expect(
      plan.skipped.some((s) => s.reason === 'fingerprint_divergence')
    ).toBe(true);
  });
});
