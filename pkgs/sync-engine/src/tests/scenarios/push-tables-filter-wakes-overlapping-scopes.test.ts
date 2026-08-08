import { describe, expect, test } from 'bun:test';
import {
  expectLiveNote,
  notesDomainPack,
  readLiveFolders,
  readLiveNotes,
  setFolder,
  setNote,
} from '../../domain-packs/notes-app';
import { RELIABLE_FAULTS } from '../../sim/faults';
import { openSimWorld } from '../../sim/world';

describe('push tables filter wakes overlapping scopes', () => {
  test('folders-only push does not wake notesOnly peer; foldersOnly peer wakes', async () => {
    // rowImageFanout false: table filter gates wake+refetch (optimistic images
    // bypass the filter when fanout is on).
    const world = await openSimWorld({
      domain: notesDomainPack,
      seed: 690,
      faults: RELIABLE_FAULTS,
      rowImageFanout: false,
    });
    try {
      const a = await world.addClient({ id: 'alice' });
      const notesPeer = await world.addClient({
        id: 'notesPeer',
        sessionQuery: { name: 'notesOnly', params: {} },
      });
      const foldersPeer = await world.addClient({
        id: 'foldersPeer',
        sessionQuery: { name: 'foldersOnly', params: {} },
      });

      await a.mutate(setNote, { id: 'n1', body: 'note-seed' });
      await world.runFor(400);
      await expectLiveNote(notesPeer.db, 'n1', { body: 'note-seed' });
      expect(await readLiveFolders(notesPeer.db)).toEqual([]);

      world.hold('notesPeer', 'sync');
      await a.mutate(setFolder, { id: 'f1', title: 'Work' });
      await world.runFor(400);

      // notesOnly ∩ tables=['folders'] = empty → no wake; still no folders.
      expect(await readLiveFolders(notesPeer.db)).toEqual([]);
      await expectLiveNote(notesPeer.db, 'n1', { body: 'note-seed' });

      // foldersOnly overlaps → wake+refetch brings folder in.
      await world.runFor(400);
      const folders = await readLiveFolders(foldersPeer.db);
      expect(folders.some((f) => f.id === 'f1')).toBe(true);

      world.release('notesPeer', 'sync');
      await world.crashClient('notesPeer');
      await world.crashClient('foldersPeer');
      await world.addClient({ id: 'bob' });
      await world.assertConverged();
      expect((await readLiveNotes(world.server.db)).length).toBeGreaterThan(0);
    } finally {
      await world.dispose();
    }
  });
});
