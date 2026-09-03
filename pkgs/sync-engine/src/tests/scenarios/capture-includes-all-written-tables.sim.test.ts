import { describe, expect, test } from 'bun:test';
import { script } from '@pkgs/dst';
import {
  acmeKnobs,
  acmeSystem,
  addClient,
  expectConverged,
  liveFolders,
  liveNote,
  mutate,
  setNoteUndeclaredFolderWrite,
  syncVirtualHost,
} from '../apps/acme';

describe('capture includes all written tables', () => {
  // Formerly "undeclared folder write misses table filter" — AST capture
  // records both folders + notes, so foldersOnly peers wake immediately.
  test('foldersOnly peer receives folder write from multi-table mutation', async () => {
    await using run = await script(acmeSystem, {
      seed: 1070,
      host: syncVirtualHost(),
      knobs: acmeKnobs({ clientCount: 0, rowImageFanout: true }),
      properties: [],
    });

    await run.apply(addClient, { id: 'alice' });
    await run.apply(addClient, {
      id: 'notesPeer',
      sessionQuery: { name: 'notesOnly', params: {} },
    });
    await run.apply(addClient, {
      id: 'foldersPeer',
      sessionQuery: { name: 'foldersOnly', params: {} },
    });

    await run.apply(mutate, 'alice', setNoteUndeclaredFolderWrite, {
      noteId: 'n1',
      folderId: 'f-captured',
      folderTitle: 'Visible',
      body: 'note-ok',
    });
    await expectConverged(run);

    expect(await run.observe(liveNote('notesPeer', 'n1'))).toMatchObject({
      body: 'note-ok',
    });
    const folders = await run.observe(liveFolders('foldersPeer'));
    expect(folders.some((f) => f.id === 'f-captured')).toBe(true);
  });

  test.each([1071, 1072, 1073])(
    'seed sweep multi-table capture visible (seed=%i)',
    async (seed) => {
      await using run = await script(acmeSystem, {
        seed: seed,
        host: syncVirtualHost(),
        knobs: acmeKnobs({ clientCount: 0, rowImageFanout: true }),
        properties: [],
      });

      await run.apply(addClient, { id: 'alice' });
      await run.apply(addClient, {
        id: 'foldersPeer',
        sessionQuery: { name: 'foldersOnly', params: {} },
      });
      await run.apply(mutate, 'alice', setNoteUndeclaredFolderWrite, {
        noteId: `n-${seed}`,
        folderId: `f-${seed}`,
        folderTitle: 'T',
        body: 'x',
      });
      await expectConverged(run);
      expect(
        (await run.observe(liveFolders('foldersPeer'))).some(
          (f) => f.id === `f-${seed}`
        )
      ).toBe(true);
    }
  );
});
