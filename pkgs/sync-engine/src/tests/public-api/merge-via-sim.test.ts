import { describe, expect, test } from 'bun:test';
import { sql } from '@pkgs/sql';
import {
  acmeLocalSchemaExtraColumn,
  acmeSystem,
  addClient,
  connect,
  deleteNote,
  disconnect,
  expectConverged,
  liveNote,
  mutate,
  rows,
  runSql,
  type SyncSurface,
  setNote,
} from '../apps/acme';

async function aliceColor(s: SyncSurface) {
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
    await using s = await acmeSystem.script({
      seed: 9001,
      args: { clientCount: 0 },
    });

    await s.apply(addClient, {
      id: 'alice',
      actorId: 'alice',
      localSchema: acmeLocalSchemaExtraColumn,
    });
    await s.apply(addClient, 'bob');

    await s.apply(mutate, 'alice', setNote, { id: 'n1', body: 'v1' });
    await expectConverged(s);

    await s.apply(
      runSql,
      'alice',
      "UPDATE notes SET color = 'red' WHERE id = 'n1'"
    );
    await s.apply(mutate, 'bob', setNote, { id: 'n1', body: 'from-bob' });
    await expectConverged(s);

    expect((await s.observe(liveNote, 'alice', 'n1'))?.body).toBe('from-bob');
    expect((await s.observe(aliceColor))[0]?.color).toBe('red');
  });

  test('tombstone upsert removes live peer row; pending rebase wins after disconnect', async () => {
    await using s = await acmeSystem.script({
      seed: 9002,
      args: { clientCount: 0 },
    });

    await s.apply(addClient, 'alice');
    await s.apply(addClient, 'bob');

    await s.apply(mutate, 'alice', setNote, { id: 'n1', body: 'seed' });
    await expectConverged(s);

    await s.apply(mutate, 'alice', deleteNote, { id: 'n1' });
    await expectConverged(s);
    expect((await s.observe(liveNote, 'bob', 'n1'))?.deletedAt).not.toBeNull();

    await s.apply(disconnect, 'alice');
    await s.apply(mutate, 'alice', setNote, {
      id: 'n1',
      body: 'optimistic-pending',
    });
    expect((await s.observe(liveNote, 'alice', 'n1'))?.body).toBe(
      'optimistic-pending'
    );

    await s.apply(connect, 'alice');
    await s.elapse(500);
    expect((await s.observe(liveNote, 'alice', 'n1'))?.body).toBe(
      'optimistic-pending'
    );
    await expectConverged(s);
    expect((await s.observe(liveNote, 'bob', 'n1'))?.body).toBe(
      'optimistic-pending'
    );
  });
});
