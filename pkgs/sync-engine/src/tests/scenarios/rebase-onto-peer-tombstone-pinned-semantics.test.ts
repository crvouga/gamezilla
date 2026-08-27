import { describe, expect, test } from 'bun:test';
import {
  deleteNote,
  expectLiveNote,
  expectNoteNotLive,
  expectNotesMatchServer,
  acmeDomainPack,
  readNoteTombstone,
  setNote,
} from '../apps/acme';
import { openSimWorld } from '../../sim/world';

describe('rebase onto peer tombstone pinned semantics', () => {
  test('pending setNote rebases onto peer tombstone and revives after upload', async () => {
    // setNote upsert clears deleted_at — pin revive semantics for all clients.
    await using world = await openSimWorld({
      domain: acmeDomainPack,
      seed: 820,
    });
    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });

    // Bob owns the row so peer soft-delete is authorized.
    await b.mutate(setNote, { id: 'n1', body: 'seed' });
    await world.assertConverged();

    await a.disconnect();
    await a.mutate(setNote, { id: 'n1', body: 'alice-pending' });
    await expectLiveNote(a.db, 'n1', { body: 'alice-pending' });

    const del = await b.mutate(deleteNote, { id: 'n1' });
    expect(del.ok).toBe(true);
    await world.runFor(400);
    await expectNoteNotLive(world.server.db, 'n1');
    expect(await readNoteTombstone(world.server.db, 'n1')).not.toBeNull();

    await a.connect();
    await world.assertConverged();

    await expectLiveNote(a.db, 'n1', { body: 'alice-pending' });
    await expectLiveNote(b.db, 'n1', { body: 'alice-pending' });
    await expectLiveNote(world.server.db, 'n1', { body: 'alice-pending' });
    await expectNotesMatchServer(a.db, world.server.db);
    await expectNotesMatchServer(b.db, world.server.db);
  });
});
