import { describe, test } from 'bun:test';
import { expectLiveNote, expectNotesMatchServer, setNote } from '../apps/acme';
import { openAcmeWorld } from '../apps/acme/system';

describe('unknown query name denied detaches scope', () => {
  test.each([780, 781, 782])(
    'unknown query denied keeps domain rows (seed=%i)',
    async (seed) => {
      await using world = await openAcmeWorld({
        seed: seed,
        knobs: {
          clientCount: 0,
        },
      });

      const a = await world.addClient({ id: 'alice' });
      await a.mutate(setNote, { id: 'n1', body: 'keep-me' });
      await world.assertConverged();
      await expectLiveNote(a.db, 'n1', { body: 'keep-me' });

      {
        using denied = a.subscribe('noSuchQueryEver', {});
        await world.waitUntil(denied.ready);
        await expectLiveNote(a.db, 'n1', { body: 'keep-me' });
        await expectNotesMatchServer(a.db, world.server.db);
      }
      // nudge: after denied scope detach, refresh remaining scopes
      await world.waitUntil(a.nudge());
      await expectLiveNote(a.db, 'n1', { body: 'keep-me' });
      await world.assertConverged();
    }
  );
});
