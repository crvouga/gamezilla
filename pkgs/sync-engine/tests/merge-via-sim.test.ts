import { describe, expect, test } from 'bun:test';
import { sql } from '@pkgs/sql';
import {
  addClient,
  connect,
  deleteNote,
  disconnect,
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
 * Public-API / sim pins for merge semantics that bulk upsert must preserve:
 * column-intersect (missing keys), tombstone upsert, pending rebase.
 */
describe('public API: merge via sim', () => {
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

  test('tombstone upsert removes live peer row; pending rebase wins after disconnect', async () => {
    await using s = await exampleSystem.run({
      seed: 9002,
      args: { clientCount: 0 },
    });

    await s.apply(addClient, 'alice');
    await s.apply(addClient, 'bob');

    await s.apply(mutate, 'alice', setNote, { id: 'n1', body: 'seed' });
    await expectInSync(s);

    await s.apply(mutate, 'alice', deleteNote, { id: 'n1' });
    await expectInSync(s);
    expect((await s.read(liveNote, 'bob', 'n1'))?.deletedAt).not.toBeNull();

    await s.apply(disconnect, 'alice');
    await s.apply(mutate, 'alice', setNote, {
      id: 'n1',
      body: 'optimistic-pending',
    });
    expect((await s.read(liveNote, 'alice', 'n1'))?.body).toBe(
      'optimistic-pending'
    );

    await s.apply(connect, 'alice');
    await s.advanceTime(500);
    expect((await s.read(liveNote, 'alice', 'n1'))?.body).toBe(
      'optimistic-pending'
    );
    await expectInSync(s);
    expect((await s.read(liveNote, 'bob', 'n1'))?.body).toBe(
      'optimistic-pending'
    );
  });
});
