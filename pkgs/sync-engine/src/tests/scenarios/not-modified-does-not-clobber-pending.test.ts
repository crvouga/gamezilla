import { describe, expect, test } from 'bun:test';
import { openWorld } from '../../sim/world';
import {
  acmeDomainPack,
  expectLiveNote,
  expectNotesMatchServer,
  readLiveNotes,
  setNote,
} from '../apps/acme';

describe('not modified does not clobber pending', () => {
  test('not_modified refetch does not clobber pending optimistic; later hash miss rebases', async () => {
    await using world = await openWorld({
      domain: acmeDomainPack,
      seed: 640,
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
