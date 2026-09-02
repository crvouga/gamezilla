import { describe, test } from 'bun:test';
import { expectLiveNote, expectNotesMatchServer, setNote } from '../apps/acme';
import { openAcmeWorld } from '../apps/acme/system';

describe('push seq gap forces refetch not image apply', () => {
  test('lost live push creates gap; later push still converges via refetch', async () => {
    await using world = await openAcmeWorld({
      seed: 804,
      knobs: {
        clientCount: 0,
      },
    });

    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });

    await a.mutate(setNote, { id: 'warm', body: 'w' });
    await world.assertConverged();

    // Drop the next live fanout (gap), keep sync so repair can refetch.
    {
      using _loss = world.net('bob', 'live').set({ dropProbability: 1 });
      await a.mutate(setNote, { id: 'n1', body: 'lost-push' });
      await world.advance(80);
    }

    // Contiguous-looking later push must not image-apply across the gap.
    {
      using _hold = world.net('bob', 'sync').set('hold');
      await a.mutate(setNote, { id: 'n2', body: 'after-gap' });
      await world.advance(200);
    }
    await world.assertConverged();

    await expectLiveNote(b.db, 'n1', { body: 'lost-push' });
    await expectLiveNote(b.db, 'n2', { body: 'after-gap' });
    await expectNotesMatchServer(b.db, world.server.db);
  });
});
