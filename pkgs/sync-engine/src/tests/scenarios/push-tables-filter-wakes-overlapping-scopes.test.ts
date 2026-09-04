import { describe, expect, test } from 'bun:test';
import {
  acmeSystem,
  addClient,
  crash,
  expectConverged,
  hold,
  mutate,
  release,
  setFolder,
  setNote,
} from '../apps/acme';
import { expectLiveNoteAt, liveFolders, liveNotes } from '../apps/acme/reads';

describe('push tables filter wakes overlapping scopes', () => {
  test('folders-only push does not wake notesOnly peer; foldersOnly peer wakes', async () => {
    // rowImageFanout false: table filter gates wake+refetch (optimistic images
    // bypass the filter when fanout is on).
    await using s = await acmeSystem.script({
      seed: 690,
      args: { clientCount: 0, rowImageFanout: false },
    });

    await s.apply(addClient, 'alice');
    await s.apply(addClient, {
      id: 'notesPeer',
      actorId: 'notesPeer',
      sessionQuery: { name: 'notesOnly', params: {} },
    });
    await s.apply(addClient, {
      id: 'foldersPeer',
      actorId: 'foldersPeer',
      sessionQuery: { name: 'foldersOnly', params: {} },
    });

    await s.apply(mutate, 'alice', setNote, { id: 'n1', body: 'note-seed' });
    await s.elapse(400);
    await expectLiveNoteAt(s, 'notesPeer', 'n1', { body: 'note-seed' });
    expect(await s.observe(liveFolders, 'notesPeer')).toEqual([]);

    await s.apply(hold, 'notesPeer', 'sync');
    await s.apply(mutate, 'alice', setFolder, { id: 'f1', title: 'Work' });
    await s.elapse(400);

    // notesOnly ∩ tables=['folders'] = empty → no wake; still no folders.
    expect(await s.observe(liveFolders, 'notesPeer')).toEqual([]);
    await expectLiveNoteAt(s, 'notesPeer', 'n1', { body: 'note-seed' });

    // foldersOnly overlaps → wake+refetch brings folder in.
    await s.elapse(400);
    const folders = await s.observe(liveFolders, 'foldersPeer');
    expect(folders.some((f) => f.id === 'f1')).toBe(true);

    await s.apply(release, 'notesPeer', 'sync');
    await s.apply(crash, 'notesPeer');
    await s.apply(crash, 'foldersPeer');
    await s.apply(addClient, 'bob');
    await expectConverged(s);
    expect((await s.observe(liveNotes, 'server')).length).toBeGreaterThan(0);
  });
});
