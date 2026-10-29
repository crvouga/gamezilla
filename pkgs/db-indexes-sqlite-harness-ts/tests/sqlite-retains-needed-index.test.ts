import { Database } from 'bun:sqlite';
import { describe, expect, test } from 'bun:test';
import { createHarnessClock } from '@pkgs/db-indexes-root-harness-ts/clock';
import { fingerprintSql } from '@pkgs/db-indexes-root-shared-ts/fingerprint';
import { reconcileIndexes } from '@pkgs/db-indexes-root-shared-ts/reconcile';
import type { WorkloadManifest } from '@pkgs/db-indexes-root-shared-ts/types';
import { createSqlitePort } from '@pkgs/db-indexes-sqlite-shared-ts/create-sqlite-port';

const NOTES_BY_USER = 'SELECT id, title FROM notes WHERE user_id = ?';

const MANIFEST: WorkloadManifest = {
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
};

describe('sqlite maintenance keeps the index its workload needs', () => {
  // regression: sqlite-retains-needed-index
  test('repeated maintenance of one workload never deprecates its index', async () => {
    const raw = new Database(':memory:');
    raw.run(
      'CREATE TABLE notes (id TEXT PRIMARY KEY, user_id TEXT, title TEXT)'
    );
    for (let i = 0; i < 100; i++) {
      raw.run('INSERT INTO notes (id, user_id, title) VALUES (?, ?, ?)', [
        `n${String(i)}`,
        `u${String(i % 10)}`,
        `t${String(i)}`,
      ]);
    }
    const port = createSqlitePort({ db: raw, idleWindow: true });
    const clock = createHarnessClock(0);
    const run = () =>
      reconcileIndexes({
        manifest: MANIFEST,
        db: port,
        clock,
        deadlineMs: 60_000,
        config: { minTableRows: 1, createEstimatedMs: 10 },
      });

    const first = await run();
    const created = first.completed.filter((a) => a.kind === 'create');
    expect(created).toHaveLength(1);

    const second = await run();
    const third = await run();

    expect(second.plan.actions).toEqual([]);
    expect(third.plan.actions).toEqual([]);
    expect(await port.readOwnedMeta()).toEqual([]);
    const owned = (await port.introspectIndexes()).filter((i) => i.isOwned);
    expect(owned.map((i) => i.name)).toEqual([created[0]!.name]);
    raw.close();
  });
});
