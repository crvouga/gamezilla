import { describe, test } from 'bun:test';

import { RELIABLE_FAULTS } from '../../sim/faults';
import {
  expectLiveNote,
  expectNoteNotLive,
  setNote,
} from '../../sim/notes-app';
import { openSimWorld } from '../../sim/world';

describe('auth revoke vs expired', () => {
  test('expired token refreshes; held queue drains and converges', async () => {
    const world = await openSimWorld({ seed: 601, faults: RELIABLE_FAULTS });
    try {
      const a = await world.addClient({ id: 'alice' });
      const b = await world.addClient({ id: 'bob' });

      await a.engine.disconnect();
      await a.mutate(setNote, { id: 'n-exp', body: 'queued-through-refresh' });
      await world.runFor(50);
      await expectNoteNotLive(world.server.db, 'n-exp');

      world.setAuthStatus('alice', 'expired');
      await a.engine.connect();
      await world.assertConverged();

      await expectLiveNote(b.db, 'n-exp', { body: 'queued-through-refresh' });
      await expectLiveNote(a.db, 'n-exp', { body: 'queued-through-refresh' });
    } finally {
      await world.dispose();
    }
  });

  test('revoked wipe drops unuploaded optimistic edit; restart rehydrates server only', async () => {
    const world = await openSimWorld({ seed: 602, faults: RELIABLE_FAULTS });
    try {
      const a = await world.addClient({ id: 'alice' });
      await world.addClient({ id: 'bob' });

      await a.mutate(setNote, { id: 'n-kept', body: 'on-server' });
      await world.assertConverged();

      // Disconnect so mutate queues without HTTP upload.
      await a.engine.disconnect();
      await a.mutate(setNote, { id: 'n-lost', body: 'never-uploaded' });
      await world.runFor(50);
      await expectNoteNotLive(world.server.db, 'n-lost');

      world.setAuthStatus('alice', 'revoked');
      // Reconnect triggers query/upload → SyncApiAuthError revoked → wipe.
      await a.engine.connect();
      await world.runFor(500);
      await expectNoteNotLive(world.server.db, 'n-lost');

      const alice2 = await world.restartClient('alice');
      await world.assertConverged();

      await expectLiveNote(alice2.db, 'n-kept', { body: 'on-server' });
      await expectNoteNotLive(alice2.db, 'n-lost');
      await expectNoteNotLive(world.server.db, 'n-lost');
    } finally {
      await world.dispose();
    }
  });
});
