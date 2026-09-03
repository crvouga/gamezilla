import { describe, expect, test } from 'bun:test';
import { script } from '@pkgs/dst';
import {
  acmeKnobs,
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
  syncVirtualHost,
} from '../apps/acme';

describe('rebase onto peer tombstone pinned semantics', () => {
  test('pending setNote rebases onto peer tombstone and revives after upload', async () => {
    // setNote upsert clears deleted_at — pin revive semantics for all clients.
    await using run = await script(acmeSystem, {
      seed: 820,
      host: syncVirtualHost(),
      knobs: acmeKnobs({ clientCount: 0 }),
      properties: [],
    });

    await run.apply(addClient, { id: 'alice' });
    await run.apply(addClient, { id: 'bob' });

    // Bob owns the row so peer soft-delete is authorized.
    await run.apply(mutate, 'bob', setNote, { id: 'n1', body: 'seed' });
    await expectConverged(run);

    await run.apply(disconnect, 'alice');
    await run.apply(mutate, 'alice', setNote, {
      id: 'n1',
      body: 'alice-pending',
    });
    expect(await run.observe(liveNote, 'alice', 'n1')).toMatchObject({
      body: 'alice-pending',
    });

    await run.apply(mutate, 'bob', deleteNote, { id: 'n1' });
    expect(await run.observe(lastMutationOk, 'bob')).toBe(true);
    await run.elapse(400);
    expect(await readNoteTombstoneAt(run, 'server', 'n1')).not.toBeNull();

    await run.apply(connect, 'alice');
    await expectConverged(run);

    expect(await run.observe(liveNote, 'alice', 'n1')).toMatchObject({
      body: 'alice-pending',
    });
    expect(await run.observe(liveNote, 'bob', 'n1')).toMatchObject({
      body: 'alice-pending',
    });
    expect(await run.observe(liveNote, 'server', 'n1')).toMatchObject({
      body: 'alice-pending',
    });
  });
});
