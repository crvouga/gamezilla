import { Database } from 'bun:sqlite';
import { describe, expect, test } from 'bun:test';
import { createHarnessClock } from '@pkgs/db-indexes-root-harness-ts/clock';
import { fingerprintSql } from '@pkgs/db-indexes-root-shared-ts/fingerprint';
import { planIndexes } from '@pkgs/db-indexes-root-shared-ts/plan';
import { createSqlitePort } from '@pkgs/db-indexes-sqlite-shared-ts/create-sqlite-port';

const NOTES_BY_USER = 'SELECT id, title FROM notes WHERE user_id = ?';

function schemaObjects(db: Database): string[] {
  return db
    .query<{ type: string; name: string }, []>(
      `SELECT type, name FROM sqlite_master ORDER BY type, name`
    )
    .all()
    .map((r) => `${r.type}:${r.name}`);
}

describe('sqlite planning is read-only', () => {
  // regression: sqlite-plan-writes-schema
  test('planning a workload leaves the schema untouched', async () => {
    const raw = new Database(':memory:');
    raw.run(
      'CREATE TABLE notes (id TEXT PRIMARY KEY, user_id TEXT, title TEXT)'
    );
    const before = schemaObjects(raw);
    const port = createSqlitePort({ db: raw });

    const plan = await planIndexes({
      manifest: {
        version: 1,
        queries: [
          {
            name: 'notesByUser',
            hydrates: ['notes'],
            statements: [
              {
                index: 0,
                sql: NOTES_BY_USER,
                fingerprint: fingerprintSql(NOTES_BY_USER),
                weight: 1,
              },
            ],
          },
        ],
      },
      db: port,
      clock: createHarnessClock(0),
      config: { minTableRows: 0 },
    });

    expect(plan.desired.length).toBeGreaterThan(0);
    expect(schemaObjects(raw)).toEqual(before);
    raw.close();
  });
});
