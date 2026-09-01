import { describe, test } from 'bun:test';
import { openWorld } from '@pkgs/determinism';
import { expectLiveNote, expectNotesMatchServer, setNote } from '../apps/acme';
import { acmeSystem } from '../apps/acme/system';

describe('reordered http responses stale checkpoint dropped', () => {
  test('reordered sync responses never regress newer domain rows', async () => {
    await using host = await openWorld(acmeSystem, {
      seed: 802,
      knobs: {
        clientCount: 0,
      },
    });
    const world = host.facade;
    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });
    await a.mutate(setNote, { id: 'warm', body: 'w' });
    await world.assertConverged();

    using _fault = world.net('bob', 'sync').set({
      oneWayDelayMeanMs: 20,
      oneWayDelayJitterMs: 40,
      reorderWindow: 6,
    });

    await a.mutate(setNote, { id: 'n1', body: 'v1' });
    await a.mutate(setNote, { id: 'n1', body: 'v2' });
    await a.mutate(setNote, { id: 'n1', body: 'v3-final' });
    await a.mutate(setNote, { id: 'n2', body: 'side' });
    await world.assertConverged();

    await expectLiveNote(b.db, 'n1', { body: 'v3-final' });
    await expectLiveNote(b.db, 'n2', { body: 'side' });
    await expectNotesMatchServer(b.db, world.server.db);
  });
});
