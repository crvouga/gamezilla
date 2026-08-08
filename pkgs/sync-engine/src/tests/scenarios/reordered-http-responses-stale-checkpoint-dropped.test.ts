import { describe, test } from 'bun:test';
import {
  expectLiveNote,
  expectNotesMatchServer,
  notesDomainPack,
  setNote,
} from '../../domain-packs/notes-app';
import { openSimWorld } from '../../sim/world';

describe('reordered http responses stale checkpoint dropped', () => {
  test('reordered sync responses never regress newer domain rows', async () => {
    await using world = await openSimWorld({
      domain: notesDomainPack,
      seed: 802,
    });
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
