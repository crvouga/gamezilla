import { describe, expect, test } from 'bun:test';
import { start } from '@pkgs/dst';
import { sql } from '@pkgs/sql';
import {
  acmeDraws,
  acmeLocalSchemaExtraColumn,
  acmeSystem,
  addClient,
  connect,
  converge,
  deleteNote,
  disconnect,
  liveNote,
  mutate,
  passTime,
  rows,
  runSql,
  setNote,
  syncVirtualHost,
} from '../apps/acme';

const aliceColor = rows<{ color: string | null }>(
  'noteColor',
  'alice',
  sql`SELECT color FROM notes WHERE id = 'n1' AND deleted_at IS NULL`
);

/**
 * Public-API / sim pins for merge semantics that bulk upsert must preserve:
 * column-intersect (missing keys), tombstone upsert, pending rebase.
 */
describe('public API: merge via sim', () => {
  test('missing server keys do not null local-only columns', async () => {
    await using run = await start(acmeSystem, {
      seed: 9001,
      host: syncVirtualHost(),
      draws: acmeDraws({ clientCount: 0 }),
      properties: [],
    });

    await run.apply(addClient, {
      id: 'alice',
      actorId: 'alice',
      localSchema: acmeLocalSchemaExtraColumn,
    });
    await run.apply(addClient, 'bob');

    await run.apply(mutate, 'alice', setNote, { id: 'n1', body: 'v1' });
    await run.apply(converge);

    await run.apply(
      runSql,
      'alice',
      "UPDATE notes SET color = 'red' WHERE id = 'n1'"
    );
    await run.apply(mutate, 'bob', setNote, { id: 'n1', body: 'from-bob' });
    await run.apply(converge);

    expect((await run.observe(liveNote('alice', 'n1')))?.body).toBe('from-bob');
    expect((await run.observe(aliceColor))[0]?.color).toBe('red');
  });

  test('tombstone upsert removes live peer row; pending rebase wins after disconnect', async () => {
    await using run = await start(acmeSystem, {
      seed: 9002,
      host: syncVirtualHost(),
      draws: acmeDraws({ clientCount: 0 }),
      properties: [],
    });

    await run.apply(addClient, 'alice');
    await run.apply(addClient, 'bob');

    await run.apply(mutate, 'alice', setNote, { id: 'n1', body: 'seed' });
    await run.apply(converge);

    await run.apply(mutate, 'alice', deleteNote, { id: 'n1' });
    await run.apply(converge);
    expect(
      (await run.observe(liveNote('bob', 'n1')))?.deletedAt
    ).not.toBeNull();

    await run.apply(disconnect, 'alice');
    await run.apply(mutate, 'alice', setNote, {
      id: 'n1',
      body: 'optimistic-pending',
    });
    expect((await run.observe(liveNote('alice', 'n1')))?.body).toBe(
      'optimistic-pending'
    );

    await run.apply(connect, 'alice');
    await run.apply(passTime, 500);
    expect((await run.observe(liveNote('alice', 'n1')))?.body).toBe(
      'optimistic-pending'
    );
    await run.apply(converge);
    expect((await run.observe(liveNote('bob', 'n1')))?.body).toBe(
      'optimistic-pending'
    );
  });
});
