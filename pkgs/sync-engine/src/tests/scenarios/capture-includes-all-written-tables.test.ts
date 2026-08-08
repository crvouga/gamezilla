import { describe, expect, test } from 'bun:test';
import {
  expectLiveNote,
  notesDomainPack,
  readLiveFolders,
  setNoteUndeclaredFolderWrite,
} from '../../domain-packs/notes-app';
import { openSimWorld } from '../../sim/world';

describe('capture includes all written tables', () => {
  // Formerly "undeclared folder write misses table filter" — AST capture
  // records both folders + notes, so foldersOnly peers wake immediately.
  test('foldersOnly peer receives folder write from multi-table mutation', async () => {
    await using world = await openSimWorld({
      domain: notesDomainPack,
      seed: 1070,
      rowImageFanout: true,
    });
    const a = await world.addClient({ id: 'alice' });
    const notesPeer = await world.addClient({
      id: 'notesPeer',
      sessionQuery: { name: 'notesOnly', params: {} },
    });
    const foldersPeer = await world.addClient({
      id: 'foldersPeer',
      sessionQuery: { name: 'foldersOnly', params: {} },
    });

    await a.mutate(setNoteUndeclaredFolderWrite, {
      noteId: 'n1',
      folderId: 'f-captured',
      folderTitle: 'Visible',
      body: 'note-ok',
    });
    await world.assertConverged();

    await expectLiveNote(notesPeer.db, 'n1', { body: 'note-ok' });
    const folders = await readLiveFolders(foldersPeer.db);
    expect(folders.some((f) => f.id === 'f-captured')).toBe(true);
  });

  test.each([1071, 1072, 1073])(
    'seed sweep multi-table capture visible (seed=%i)',
    async (seed) => {
      await using world = await openSimWorld({
        domain: notesDomainPack,
        seed,
        rowImageFanout: true,
      });
      const a = await world.addClient({ id: 'alice' });
      const foldersPeer = await world.addClient({
        id: 'foldersPeer',
        sessionQuery: { name: 'foldersOnly', params: {} },
      });
      await a.mutate(setNoteUndeclaredFolderWrite, {
        noteId: `n-${seed}`,
        folderId: `f-${seed}`,
        folderTitle: 'T',
        body: 'x',
      });
      await world.assertConverged();
      expect(
        (await readLiveFolders(foldersPeer.db)).some(
          (f) => f.id === `f-${seed}`
        )
      ).toBe(true);
    }
  );
});
