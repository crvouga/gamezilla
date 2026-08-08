import { describe, test } from 'bun:test';
import {
  expectLiveNote,
  expectNotesMatchServer,
  notesDomainPack,
  setNote,
} from '../../domain-packs/notes-app';
import { openSimWorld } from '../../sim/world';

describe('unknown query name denied detaches scope', () => {
  test.each([780, 781, 782])(
    'unknown query denied keeps domain rows (seed=%i)',
    async (seed) => {
      await using world = await openSimWorld({
        domain: notesDomainPack,
        seed,
      });
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
