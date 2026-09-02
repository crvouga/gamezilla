import { describe, test } from 'bun:test';
import { expectLiveNote, expectNotesMatchServer, setNote } from '../apps/acme';
import { openAcmeWorld } from '../apps/acme/system';

describe('denied query detaches scope keeps rows', () => {
  test('denied query detaches scope without wiping domain', async () => {
    await using world = await openAcmeWorld({
      seed: 512,
      knobs: {
        clientCount: 0,
      },
    });

    const a = await world.addClient({ id: 'alice' });
    await a.mutate(setNote, { id: 'n1', body: 'keep-me' });
    await world.assertConverged();
    await expectLiveNote(a.db, 'n1', { body: 'keep-me' });

    {
      using denied = a.subscribe('notesDenied', {});
      await world.waitUntil(denied.ready);
      await expectLiveNote(a.db, 'n1', { body: 'keep-me' });
      await expectNotesMatchServer(a.db, world.server.db);
    }
    // nudge: refresh after denied-scope unsubscribe
    await world.waitUntil(a.nudge());
    await expectLiveNote(a.db, 'n1', { body: 'keep-me' });
  });
});
