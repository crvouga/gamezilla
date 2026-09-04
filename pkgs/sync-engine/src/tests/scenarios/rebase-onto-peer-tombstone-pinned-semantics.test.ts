import { describe, expect, test } from 'bun:test';
import {
  acmeSystem,
  addClient,
  connect,
  deleteNote,
  disconnect,
  expectConverged,
  lastMutationOk,
  liveNote,
  mutate,
  readNoteTombstoneAt,
  setNote,
} from '../apps/acme';

describe('rebase onto peer tombstone pinned semantics', () => {
  test('pending setNote rebases onto peer tombstone and revives after upload', async () => {
    // setNote upsert clears deleted_at — pin revive semantics for all clients.
    await using s = await acmeSystem.script({
      seed: 820,
      args: { clientCount: 0 },
    });

    await s.apply(addClient, { id: 'alice' });
    await s.apply(addClient, { id: 'bob' });

    // Bob owns the row so peer soft-delete is authorized.
    await s.apply(mutate, 'bob', setNote, { id: 'n1', body: 'seed' });
    await expectConverged(s);

    await s.apply(disconnect, 'alice');
    await s.apply(mutate, 'alice', setNote, {
      id: 'n1',
      body: 'alice-pending',
    });
    expect(await s.observe(liveNote, 'alice', 'n1')).toMatchObject({
      body: 'alice-pending',
    });

    await s.apply(mutate, 'bob', deleteNote, { id: 'n1' });
    expect(await s.observe(lastMutationOk, 'bob')).toBe(true);
    await s.elapse(400);
    expect(await readNoteTombstoneAt(s, 'server', 'n1')).not.toBeNull();

    await s.apply(connect, 'alice');
    await expectConverged(s);

    expect(await s.observe(liveNote, 'alice', 'n1')).toMatchObject({
      body: 'alice-pending',
    });
    expect(await s.observe(liveNote, 'bob', 'n1')).toMatchObject({
      body: 'alice-pending',
    });
    expect(await s.observe(liveNote, 'server', 'n1')).toMatchObject({
      body: 'alice-pending',
    });
  });
});
