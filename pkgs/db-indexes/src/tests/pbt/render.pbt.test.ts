import { describe, expect, test } from 'bun:test';
import { assertProperty } from '@pkgs/dst/fast-check';
import fc from 'fast-check';
import { fingerprintSql } from '../../core/fingerprint';
import { planIndexes } from '../../core/plan';
import { renderPlanMarkdown } from '../../core/render';
import { genSchema, genSmallManifest } from '../generators';
import { fixedClock, RecordingPort } from '../helpers/recording-port';

describe('render PBT', () => {
  test('renderPlanMarkdown never throws; mentions every create/drop', async () => {
    await assertProperty(
      'render',
      fc.asyncProperty(genSchema, async (schema) => {
        const manifest = await fc.sample(genSmallManifest(schema), 1)[0]!;
        const tables = schema.tables.map((t) => ({
          name: t.name,
          estimatedRows: Math.max(t.estimatedRows, 10_000),
        }));
        const plan = await planIndexes({
          manifest,
          db: new RecordingPort({
            indexes: [],
            tables,
            usage: [],
            metas: [],
            defaultImprovement: 10,
          }),
          clock: fixedClock(0),
          config: { minTableRows: 1 },
        });
        const md = renderPlanMarkdown(plan, manifest);
        expect(typeof md).toBe('string');
        for (const a of plan.actions) {
          if (a.kind === 'create' || a.kind === 'drop') {
            expect(md.includes(a.name)).toBe(true);
          }
        }
      }),
      { numRuns: 12 }
    );
  });

  test('empty plan renders', () => {
    const emptyManifest = { version: 1 as const, queries: [] };
    const md = renderPlanMarkdown(
      {
        desired: [],
        actions: [],
        skipped: [],
        kept: [],
      },
      emptyManifest
    );
    expect(md.length).toBeGreaterThan(0);
  });
});

describe('render smoke', () => {
  test('mentions create name', async () => {
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
      config: { minTableRows: 1 },
    });
    const md = renderPlanMarkdown(plan, manifest);
    for (const a of plan.actions.filter((x) => x.kind === 'create')) {
      expect(md).toContain(a.name);
    }
  });
});
