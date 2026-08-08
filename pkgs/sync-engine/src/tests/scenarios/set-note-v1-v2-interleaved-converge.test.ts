import { describe, expect, test } from 'bun:test';

import { RELIABLE_FAULTS } from '../../sim/faults';
import {
  expectLiveNote,
  expectNotesMatchServer,
  readLiveNotes,
  setNote,
  setNoteV2,
} from '../../sim/notes-app';
import { openSimWorld } from '../../sim/world';

describe('set note v1 v2 interleaved converge', () => {
  test('setNote and setNoteV2 interleaved writes converge', async () => {
    const world = await openSimWorld({ seed: 660, faults: RELIABLE_FAULTS });
    try {
      const a = await world.addClient({ id: 'alice' });
      const b = await world.addClient({ id: 'bob' });

      await a.mutate(setNote, { id: 'shared', body: 'v1-a' });
      await b.mutate(setNoteV2, { id: 'shared', body: 'v2-b' });
      await a.mutate(setNote, { id: 'only-a', body: 'from-v1' });
      await b.mutate(setNoteV2, { id: 'only-b', body: 'from-v2' });
      await world.assertConverged();

      await expectLiveNote(a.db, 'only-a', { body: 'from-v1' });
      await expectLiveNote(b.db, 'only-b', { body: 'from-v2' });
      await expectNotesMatchServer(a.db, world.server.db);
      await expectNotesMatchServer(b.db, world.server.db);
      const shared = (await readLiveNotes(world.server.db)).find(
        (r) => r.id === 'shared'
      );
      expect(shared?.body === 'v1-a' || shared?.body === 'v2-b').toBe(true);
    } finally {
      await world.dispose();
    }
  });
});
