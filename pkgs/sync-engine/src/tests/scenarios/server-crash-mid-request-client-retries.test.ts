import { describe, test } from 'bun:test';

import { RELIABLE_FAULTS } from '../../sim/faults';
import {
  expectLiveNote,
  expectNotesMatchServer,
  setNote,
} from '../../sim/notes-app';
import { openSimWorld } from '../../sim/world';

describe('server crash mid request client retries', () => {
  test('server dies mid traffic; restart; clients retry and converge', async () => {
    const world = await openSimWorld({ seed: 833, faults: RELIABLE_FAULTS });
    try {
      const a = await world.addClient({ id: 'alice' });
      const b = await world.addClient({ id: 'bob' });

      await a.mutate(setNote, { id: 'warm', body: 'w' });
      await world.assertConverged();

      world.hold('alice', 'sync');
      const pending = a.mutate(setNote, { id: 'n1', body: 'during-crash' });
      await world.runFor(20);
      await world.crashServer();
      await world.runFor(50);
      await world.restartServer({ preserveDb: true });
      world.release('alice', 'sync');
      a.engine.wakeUploads();
      void pending;
      await world.assertConverged();

      await expectLiveNote(b.db, 'n1', { body: 'during-crash' });
      await expectNotesMatchServer(a.db, world.server.db);
      await expectNotesMatchServer(b.db, world.server.db);

      // Query path also recovers after server restart.
      await b.mutate(setNote, { id: 'n2', body: 'after-restart' });
      await world.assertConverged();
      await expectLiveNote(a.db, 'n2', { body: 'after-restart' });
    } finally {
      await world.dispose();
    }
  });
});
