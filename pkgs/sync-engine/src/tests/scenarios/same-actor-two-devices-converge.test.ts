import { describe, test } from 'bun:test';

import { RELIABLE_FAULTS } from '../../sim/faults';
import {
  expectLiveNote,
  expectNotesMatchServer,
  setNote,
} from '../../sim/notes-app';
import { openSimWorld } from '../../sim/world';

describe('same actor two devices converge', () => {
  test('two devices same actor converge concurrent writes', async () => {
    const world = await openSimWorld({ seed: 509, faults: RELIABLE_FAULTS });
    try {
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
    } finally {
      await world.dispose();
    }
  });
});
