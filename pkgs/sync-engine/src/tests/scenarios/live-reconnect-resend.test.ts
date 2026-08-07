import { describe, test } from 'bun:test';

import { RELIABLE_FAULTS } from '../../sim/faults';
import {
  expectLiveNote,
  expectNoteNotLive,
  setNote,
} from '../../sim/notes-app';
import { openSimWorld } from '../../sim/world';

describe('live reconnect resend', () => {
  test('default: missed live is dropped; sync pull repairs', async () => {
    const world = await openSimWorld({ seed: 601, faults: RELIABLE_FAULTS });
    try {
      const a = await world.addClient({ id: 'alice' });
      const b = await world.addClient({ id: 'bob' });
      await a.mutate(setNote, { id: 'warm', body: 'w' });
      await world.assertConverged();

      await b.engine.disconnect();
      world.hold('bob', 'sync');
      await a.mutate(setNote, { id: 'n1', body: 'while-down' });
      await world.runFor(80);

      await b.engine.connect();
      await world.runFor(200);
      await expectNoteNotLive(b.db, 'n1');

      world.release('bob', 'sync');
      await world.assertConverged();
      await expectLiveNote(b.db, 'n1', { body: 'while-down' });
    } finally {
      await world.dispose();
    }
  });

  test('liveResendOnReconnect: consistent from resent live while sync held', async () => {
    const world = await openSimWorld({
      seed: 602,
      faults: RELIABLE_FAULTS,
      liveResendOnReconnect: true,
    });
    try {
      const a = await world.addClient({ id: 'alice' });
      const b = await world.addClient({ id: 'bob' });
      await a.mutate(setNote, { id: 'warm', body: 'w' });
      await world.assertConverged();

      await b.engine.disconnect();
      world.hold('bob', 'sync');
      await a.mutate(setNote, { id: 'n1', body: 'resent' });
      await world.runFor(80);

      await b.engine.connect();
      await world.runFor(200);
      await expectLiveNote(b.db, 'n1', { body: 'resent' });

      world.release('bob', 'sync');
      await world.assertConverged();
      await expectLiveNote(b.db, 'n1', { body: 'resent' });
    } finally {
      await world.dispose();
    }
  });
});
