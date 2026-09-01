import { describe, test } from 'bun:test';
import { openWorld } from '@pkgs/determinism';
import { expectLiveNote, expectNotesMatchServer, setNote } from '../apps/acme';
import { acmeSystem } from '../apps/acme/system';

describe('row image apply then refetch not not modified', () => {
  test('live row-image paint while sync held still converges after refetch', async () => {
    // Row images must not advance content hash; release+refetch stays sound.
    await using host = await openWorld(acmeSystem, {
      seed: 801,
      knobs: {
        clientCount: 0,
      },
    });
    const world = host.facade;
    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });

    await a.mutate(setNote, { id: 'n1', body: 'seed' });
    await a.mutate(setNote, { id: 'n2', body: 'other' });
    await world.assertConverged();

    {
      using _hold = world.net('bob', 'sync').set('hold');
      await a.mutate(setNote, { id: 'n1', body: 'via-image' });
      await world.runFor(300);
      await expectLiveNote(b.db, 'n1', { body: 'via-image' });
      await expectLiveNote(b.db, 'n2', { body: 'other' });
    }
    // nudge: release sync — refetch must not be not-modified after row-image paint
    await world.until(b.nudge());
    await world.assertConverged();
    await expectLiveNote(b.db, 'n1', { body: 'via-image' });
    await expectNotesMatchServer(b.db, world.server.db);
  });
});
