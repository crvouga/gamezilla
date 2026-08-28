import { describe, test } from 'bun:test';
import { openSimWorld } from '../../sim/world';
import {
  acmeDomainPack,
  expectLiveNote,
  expectNotesMatchServer,
  setNote,
} from '../apps/acme';

describe('push seq gap forces refetch not image apply', () => {
  test('lost live push creates gap; later push still converges via refetch', async () => {
    await using world = await openSimWorld({
      domain: acmeDomainPack,
      seed: 804,
    });
    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });

    await a.mutate(setNote, { id: 'warm', body: 'w' });
    await world.assertConverged();

    // Drop the next live fanout (gap), keep sync so repair can refetch.
    {
      using _loss = world.net('bob', 'live').set({ packetLossProbability: 1 });
      await a.mutate(setNote, { id: 'n1', body: 'lost-push' });
      await world.runFor(80);
    }

    // Contiguous-looking later push must not image-apply across the gap.
    {
      using _hold = world.net('bob', 'sync').set('hold');
      await a.mutate(setNote, { id: 'n2', body: 'after-gap' });
      await world.runFor(200);
    }
    await world.assertConverged();

    await expectLiveNote(b.db, 'n1', { body: 'lost-push' });
    await expectLiveNote(b.db, 'n2', { body: 'after-gap' });
    await expectNotesMatchServer(b.db, world.server.db);
  });
});
