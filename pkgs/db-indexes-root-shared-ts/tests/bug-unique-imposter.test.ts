import { describe, expect, test } from 'bun:test';
import { fingerprintSql } from '@pkgs/db-indexes-root-shared-ts/fingerprint';
import { planIndexes } from '@pkgs/db-indexes-root-shared-ts/plan';
import { fixedClock, RecordingPort } from './recording-port';

/**
 * BUG-1 pin: unique index whose name matches owned regex must be ignored.
 */
describe('BUG-1 unique autoidx imposter', () => {
  test('planIndexes skips unique owned-named imposter without crash', async () => {
    const sql = 'SELECT id FROM notes WHERE user_id = ?';
    const db = new RecordingPort({
      indexes: [
        {
          name: 'autoidx_notes_deadbeef',
          table: 'notes',
          columns: ['c0'],
          include: [],
          predicate: null,
          isUnique: true,
          isPrimary: false,
          isValid: true,
          isOwned: false,
        },
      ],
      tables: [{ name: 'notes', estimatedRows: 50_000 }],
      usage: [],
      metas: [],
      defaultImprovement: 10,
    });
    const plan = await planIndexes({
      manifest: {
        version: 1,
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
      },
      db,
      clock: fixedClock(0),
      config: { minTableRows: 1 },
    });
    expect(plan.actions.every((a) => a.name !== 'autoidx_notes_deadbeef')).toBe(
      true
    );
  });
});
