import { describe, expect, test } from 'bun:test';
import {
  expectLiveNote,
  expectNotesMatchServer,
  notesDomainPack,
  readLiveNotes,
  setNote,
} from '../../domain-packs/notes-app';
import { RELIABLE_FAULTS } from '../../sim/faults';
import { openSimWorld } from '../../sim/world';

describe('not modified does not clobber pending', () => {
  test('not_modified refetch does not clobber pending optimistic; later hash miss rebases', async () => {
    await using world = await openSimWorld({
      domain: notesDomainPack,
      seed: 640,
      faults: RELIABLE_FAULTS,
    });
    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });

    await a.mutate(setNote, { id: 'n1', body: 'seed' });
    await world.assertConverged();

    // Queue pending without upload (upload loop stopped).
    await a.disconnect();
    await a.mutate(setNote, { id: 'n1', body: 'optimistic-pending' });
    await expectLiveNote(a.db, 'n1', { body: 'optimistic-pending' });
    await expectLiveNote(world.server.db, 'n1', { body: 'seed' });

    // Reconnect: session sync sees unchanged server hash → not_modified;
    // pending mutation rebases on top so optimistic body must survive.
    await a.connect();
    await world.runFor(500);
    await expectLiveNote(a.db, 'n1', { body: 'optimistic-pending' });

    await b.mutate(setNote, { id: 'n1', body: 'from-bob' });
    await world.assertConverged();

    await expectNotesMatchServer(a.db, world.server.db);
    await expectNotesMatchServer(b.db, world.server.db);
    expect(
      (await readLiveNotes(world.server.db)).find((r) => r.id === 'n1')
    ).toBeDefined();
  });
});
