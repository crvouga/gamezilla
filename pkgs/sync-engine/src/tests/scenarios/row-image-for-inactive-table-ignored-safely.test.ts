import { describe, expect, test } from 'bun:test';
import {
  expectLiveNote,
  notesDomainPack,
  readLiveFolders,
  setFolder,
  setNote,
} from '../../domain-packs/notes-app';
import { RELIABLE_FAULTS } from '../../sim/faults';
import { openSimWorld } from '../../sim/world';

describe('row image for inactive table ignored safely', () => {
  test('server folders push ignored by notesOnly peer; later note push applies', async () => {
    const world = await openSimWorld({
      domain: notesDomainPack,
      seed: 807,
      faults: RELIABLE_FAULTS,
    });
    try {
      const a = await world.addClient({ id: 'alice' });
      const notesPeer = await world.addClient({
        id: 'notesPeer',
        sessionQuery: { name: 'notesOnly', params: {} },
      });

      await a.mutate(setNote, { id: 'n1', body: 'seed' });
      await world.runFor(400);
      await expectLiveNote(notesPeer.db, 'n1', { body: 'seed' });
      expect(await readLiveFolders(notesPeer.db)).toEqual([]);

      // No optimistic fanout — only server push (table-filtered).
      await a.engine.disconnect();
      await a.mutate(setFolder, { id: 'f1', title: 'ignored' });
      world.hold('notesPeer', 'sync');
      await a.engine.connect();
      a.engine.wakeUploads();
      await world.runFor(400);

      expect(await readLiveFolders(notesPeer.db)).toEqual([]);
      await expectLiveNote(notesPeer.db, 'n1', { body: 'seed' });

      await a.mutate(setNote, { id: 'n1', body: 'after-ignore' });
      await world.runFor(300);
      await expectLiveNote(notesPeer.db, 'n1', { body: 'after-ignore' });

      world.release('notesPeer', 'sync');
      await world.crashClient('notesPeer');
      await world.addClient({ id: 'bob' });
      await world.assertConverged();
    } finally {
      await world.dispose();
    }
  });
});
