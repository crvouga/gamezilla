import { describe, test } from 'bun:test';
import {
  expectLiveNote,
  expectNotesMatchServer,
  notesDomainPack,
  setNote,
} from '../../domain-packs/notes-app';
import { RELIABLE_FAULTS } from '../../sim/faults';
import { openSimWorld } from '../../sim/world';

describe('row image apply then refetch not not modified', () => {
  test('live row-image paint while sync held still converges after refetch', async () => {
    // Row images must not advance content hash; release+refetch stays sound.
    await using world = await openSimWorld({
      domain: notesDomainPack,
      seed: 801,
      faults: RELIABLE_FAULTS,
    });
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
