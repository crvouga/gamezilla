import { describe, expect, test } from 'bun:test';
import {
  expectLiveNote,
  notesDomainPack,
  readLiveFolders,
  setNoteUndeclaredFolderWrite,
} from '../../domain-packs/notes-app';
import { openSimWorld } from '../../sim/world';

describe('undeclared table write misses table filter heals on wakeall', () => {
  // README known limitation 8 declaredWrites — push table filter only; not enforced.
  test('foldersOnly peer misses undeclared folder write until wakeAll refetch', async () => {
    await using world = await openSimWorld({
      domain: notesDomainPack,
      seed: 1070,
      rowImageFanout: false,
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

    {
      using _hold = world.net('foldersPeer', 'sync').set('hold');
      await a.mutate(setNoteUndeclaredFolderWrite, {
        noteId: 'n1',
        folderId: 'f-undeclared',
        folderTitle: 'Hidden',
        body: 'note-ok',
      });
      await world.runFor(400);

      // notes declared → notesOnly peer can wake; folders write undeclared.
      await expectLiveNote(notesPeer.db, 'n1', { body: 'note-ok' });
      expect(await readLiveFolders(foldersPeer.db)).toEqual([]);
    }
    await foldersPeer.disconnect();
    await foldersPeer.connect();
    await world.runFor(500);
    const folders = await readLiveFolders(foldersPeer.db);
    expect(folders.some((f) => f.id === 'f-undeclared')).toBe(true);

    await world.node('notesPeer').crash();
    await world.node('foldersPeer').crash();
    await world.assertConverged();
  });

  test.each([1071, 1072, 1073])(
    'seed sweep undeclared folder write eventually visible (seed=%i)',
    async (seed) => {
      await using world = await openSimWorld({
        domain: notesDomainPack,
        seed,
        rowImageFanout: false,
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
      // nudge: undeclared folder write missed table filter — heal by refetch
      await world.until(foldersPeer.nudge());
      expect(
        (await readLiveFolders(foldersPeer.db)).some(
          (f) => f.id === `f-${seed}`
        )
      ).toBe(true);
      await world.node('foldersPeer').crash();
      await world.assertConverged();
    }
  );
});
