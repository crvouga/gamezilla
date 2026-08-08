import { describe, test } from 'bun:test';
import {
  expectLiveNote,
  expectNotesMatchServer,
  notesDomainPack,
  setNote,
} from '../../domain-packs/notes-app';
import { openSimWorld } from '../../sim/world';

describe('denied query detaches scope keeps rows', () => {
  test('denied query detaches scope without wiping domain', async () => {
    await using world = await openSimWorld({
      domain: notesDomainPack,
      seed: 512,
    });
    const a = await world.addClient({ id: 'alice' });
    await a.mutate(setNote, { id: 'n1', body: 'keep-me' });
    await world.assertConverged();
    await expectLiveNote(a.db, 'n1', { body: 'keep-me' });

    {
      using denied = a.subscribe('notesDenied', {});
      await world.until(denied.ready);
      await expectLiveNote(a.db, 'n1', { body: 'keep-me' });
      await expectNotesMatchServer(a.db, world.server.db);
    }
    // nudge: refresh after denied-scope unsubscribe
    await world.until(a.nudge());
    await expectLiveNote(a.db, 'n1', { body: 'keep-me' });
  });
});
