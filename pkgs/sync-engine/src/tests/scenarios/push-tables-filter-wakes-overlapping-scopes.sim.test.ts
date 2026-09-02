import { describe, expect, test } from 'bun:test';
import {
  expectLiveNote,
  readLiveFolders,
  readLiveNotes,
  setFolder,
  setNote,
} from '../apps/acme';
import { openAcmeWorld } from '../apps/acme/system';

describe('push tables filter wakes overlapping scopes', () => {
  test('folders-only push does not wake notesOnly peer; foldersOnly peer wakes', async () => {
    // rowImageFanout false: table filter gates wake+refetch (optimistic images
    // bypass the filter when fanout is on).
    await using world = await openAcmeWorld({
      seed: 690,
      knobs: {
        clientCount: 0,
        rowImageFanout: false,
      },
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

    await a.mutate(setNote, { id: 'n1', body: 'note-seed' });
    await world.advance(400);
    await expectLiveNote(notesPeer.db, 'n1', { body: 'note-seed' });
    expect(await readLiveFolders(notesPeer.db)).toEqual([]);

    {
      using _hold = world.net('notesPeer', 'sync').set('hold');
      await a.mutate(setFolder, { id: 'f1', title: 'Work' });
      await world.advance(400);

      // notesOnly ∩ tables=['folders'] = empty → no wake; still no folders.
      expect(await readLiveFolders(notesPeer.db)).toEqual([]);
      await expectLiveNote(notesPeer.db, 'n1', { body: 'note-seed' });

      // foldersOnly overlaps → wake+refetch brings folder in.
      await world.advance(400);
      const folders = await readLiveFolders(foldersPeer.db);
      expect(folders.some((f) => f.id === 'f1')).toBe(true);
    }
    await world.node('notesPeer').crash();
    await world.node('foldersPeer').crash();
    await world.addClient({ id: 'bob' });
    await world.assertConverged();
    expect((await readLiveNotes(world.server.db)).length).toBeGreaterThan(0);
  });
});
