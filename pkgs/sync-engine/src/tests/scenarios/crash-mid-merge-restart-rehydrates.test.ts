import { describe, expect, test } from 'bun:test';
import { openSimWorld } from '../../sim/world';
import {
  acmeDomainPack,
  expectLiveNote,
  expectNotesMatchServer,
  readLiveNotes,
  setNote,
} from '../apps/acme';

describe('crash mid merge restart rehydrates', () => {
  test('crash after sync delivery; restart never torn across tables', async () => {
    await using world = await openSimWorld({
      domain: acmeDomainPack,
      seed: 830,
      // Force sync refetch path so afterNextSyncResponseDelivered fires.
      rowImageFanout: false,
    });
    const a = await world.addClient({ id: 'alice' });
    await world.addClient({ id: 'bob' });

    await a.mutate(setNote, { id: 'n1', body: 'one' });
    await a.mutate(setNote, { id: 'n2', body: 'two' });
    await world.assertConverged();

    using _arm = world.node('bob').crash({
      at: 'afterNextSyncResponseDelivered',
    });
    await a.mutate(setNote, { id: 'n1', body: 'updated' });
    await a.mutate(setNote, { id: 'n3', body: 'three' });
    await world.runFor(800);

    expect(world.clients.has('bob')).toBe(false);
    const bob = await world.node('bob').restart({ preserveLocalDb: true });
    await world.assertConverged();

    const notes = await readLiveNotes(bob!.db);
    const ids = new Set(notes.map((n) => n.id));
    expect(ids.has('n1')).toBe(true);
    expect(ids.has('n2')).toBe(true);
    await expectLiveNote(bob!.db, 'n1', { body: 'updated' });
    await expectLiveNote(bob!.db, 'n3', { body: 'three' });
    await expectNotesMatchServer(bob!.db, world.server.db);
  });
});
