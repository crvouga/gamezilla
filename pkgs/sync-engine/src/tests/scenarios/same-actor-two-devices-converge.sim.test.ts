import { openWorld } from '@pkgs/determinism';
import { acmeSystem } from '../apps/acme/system';
import { syncFacade } from '../../sim/system';
import { describe, test } from 'bun:test';
import { expectLiveNote, expectNotesMatchServer, setNote } from '../apps/acme';

describe('same actor two devices converge', () => {
  test('two devices same actor converge concurrent writes', async () => {
    await using host = await openWorld(acmeSystem, {
      seed: 509,
      knobs: {
        clientCount: 0,
      },
    });
    const world = syncFacade(host.system);
    const phone = await world.addClient({
      id: 'phone',
      actorId: 'user-1',
    });
    const tablet = await world.addClient({
      id: 'tablet',
      actorId: 'user-1',
    });

    await phone.mutate(setNote, { id: 'from-phone', body: 'p' });
    await tablet.mutate(setNote, { id: 'from-tablet', body: 't' });
    await world.assertConverged();

    await expectLiveNote(phone.db, 'from-phone', { body: 'p' });
    await expectLiveNote(phone.db, 'from-tablet', { body: 't' });
    await expectLiveNote(tablet.db, 'from-phone', { body: 'p' });
    await expectLiveNote(tablet.db, 'from-tablet', { body: 't' });
    await expectNotesMatchServer(phone.db, world.server.db);
    await expectNotesMatchServer(tablet.db, world.server.db);
  });
});
