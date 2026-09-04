import { describe, expect, test } from 'bun:test';
import {
  acmeSystem,
  addClient,
  expectConverged,
  liveFolders,
  liveNote,
  mutate,
  setNoteUndeclaredFolderWrite,
} from '../apps/acme';

describe('capture includes all written tables', () => {
  // Formerly "undeclared folder write misses table filter" — AST capture
  // records both folders + notes, so foldersOnly peers wake immediately.
  test('foldersOnly peer receives folder write from multi-table mutation', async () => {
    await using s = await acmeSystem.script({
      seed: 1070,
      args: { clientCount: 0, rowImageFanout: true },
    });

    await s.apply(addClient, { id: 'alice' });
    await s.apply(addClient, {
      id: 'notesPeer',
      sessionQuery: { name: 'notesOnly', params: {} },
    });
    await s.apply(addClient, {
      id: 'foldersPeer',
      sessionQuery: { name: 'foldersOnly', params: {} },
    });

    await s.apply(mutate, 'alice', setNoteUndeclaredFolderWrite, {
      noteId: 'n1',
      folderId: 'f-captured',
      folderTitle: 'Visible',
      body: 'note-ok',
    });
    await expectConverged(s);

    expect(await s.observe(liveNote, 'notesPeer', 'n1')).toMatchObject({
      body: 'note-ok',
    });
    const folders = await s.observe(liveFolders, 'foldersPeer');
    expect(folders.some((f) => f.id === 'f-captured')).toBe(true);
  });

  test.each([1071, 1072, 1073])(
    'seed sweep multi-table capture visible (seed=%i)',
    async (seed) => {
      await using s = await acmeSystem.script({
        seed: seed,
        args: { clientCount: 0, rowImageFanout: true },
      });

      await s.apply(addClient, { id: 'alice' });
      await s.apply(addClient, {
        id: 'foldersPeer',
        sessionQuery: { name: 'foldersOnly', params: {} },
      });
      await s.apply(mutate, 'alice', setNoteUndeclaredFolderWrite, {
        noteId: `n-${seed}`,
        folderId: `f-${seed}`,
        folderTitle: 'T',
        body: 'x',
      });
      await expectConverged(s);
      expect(
        (await s.observe(liveFolders, 'foldersPeer')).some(
          (f) => f.id === `f-${seed}`
        )
      ).toBe(true);
    }
  );
});
