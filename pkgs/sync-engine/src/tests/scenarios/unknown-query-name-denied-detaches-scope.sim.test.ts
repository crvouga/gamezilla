import { describe, test } from 'bun:test';
import { openWorld } from '@pkgs/determinism';
import { expectLiveNote, expectNotesMatchServer, setNote } from '../apps/acme';
import { acmeSystem } from '../apps/acme/system';

describe('unknown query name denied detaches scope', () => {
  test.each([780, 781, 782])(
    'unknown query denied keeps domain rows (seed=%i)',
    async (seed) => {
      await using host = await openWorld(acmeSystem, {
        seed: seed,
        knobs: {
          clientCount: 0,
        },
      });
      const world = host.facade;
      const a = await world.addClient({ id: 'alice' });
      await a.mutate(setNote, { id: 'n1', body: 'keep-me' });
      await world.assertConverged();
      await expectLiveNote(a.db, 'n1', { body: 'keep-me' });

      {
        using denied = a.subscribe('noSuchQueryEver', {});
        await world.until(denied.ready);
        await expectLiveNote(a.db, 'n1', { body: 'keep-me' });
        await expectNotesMatchServer(a.db, world.server.db);
      }
      // nudge: after denied scope detach, refresh remaining scopes
      await world.until(a.nudge());
      await expectLiveNote(a.db, 'n1', { body: 'keep-me' });
      await world.assertConverged();
    }
  );
});
