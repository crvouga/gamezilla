import { describe, expect, test } from 'bun:test';
import { sql } from '@pkgs/sql';
import {
  addClient,
  exampleLocalSchemaExtraColumn,
  exampleSystem,
  expectInSync,
  liveNote,
  mutate,
  rows,
  runSql,
  type SyncSim,
  setNote,
} from '@pkgs/sync-engine/sim';

async function aliceColor(s: SyncSim) {
  return rows(
    s,
    'noteColor',
    'alice',
    sql`SELECT color FROM notes WHERE id = 'n1' AND deleted_at IS NULL`
  ) as Promise<{ readonly color: string | null }[]>;
}

/**
 * Merge upserts the columns a snapshot carries and leaves a device's
 * local-only columns alone (column intersect). Tombstone upsert and pending
 * rebase are covered by `note-replication.quint.test.ts` and
 * `pending-rebase.property.test.ts`.
 */
describe('merge keeps local-only columns', () => {
  test('missing server keys do not null local-only columns', async () => {
    await using s = await exampleSystem.run({
      seed: 9001,
      args: { clientCount: 0 },
    });

    await s.apply(addClient, {
      id: 'alice',
      actorId: 'alice',
      localSchema: exampleLocalSchemaExtraColumn,
    });
    await s.apply(addClient, 'bob');

    await s.apply(mutate, 'alice', setNote, { id: 'n1', body: 'v1' });
    await expectInSync(s);

    await s.apply(
      runSql,
      'alice',
      "UPDATE notes SET color = 'red' WHERE id = 'n1'"
    );
    await s.apply(mutate, 'bob', setNote, { id: 'n1', body: 'from-bob' });
    await expectInSync(s);

    expect((await s.read(liveNote, 'alice', 'n1'))?.body).toBe('from-bob');
    expect((await s.read(aliceColor))[0]?.color).toBe('red');
  });
});
