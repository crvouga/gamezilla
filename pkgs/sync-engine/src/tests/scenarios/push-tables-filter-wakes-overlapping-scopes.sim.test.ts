import { describe, expect, test } from 'bun:test';
import { start } from '@pkgs/dst';
import {
  acmeDraws,
  acmeSystem,
  addClient,
  crash,
  expectConverged,
  hold,
  mutate,
  passTime,
  release,
  setFolder,
  setNote,
  syncVirtualHost,
} from '../apps/acme';
import { expectLiveNoteAt, liveFolders, liveNotes } from '../apps/acme/reads';

describe('push tables filter wakes overlapping scopes', () => {
  test('folders-only push does not wake notesOnly peer; foldersOnly peer wakes', async () => {
    // rowImageFanout false: table filter gates wake+refetch (optimistic images
    // bypass the filter when fanout is on).
    await using run = await start(acmeSystem, {
      seed: 690,
      host: syncVirtualHost(),
      draws: acmeDraws({ clientCount: 0, rowImageFanout: false }),
      properties: [],
    });

    await run.apply(addClient, 'alice');
    await run.apply(addClient, {
      id: 'notesPeer',
      actorId: 'notesPeer',
      sessionQuery: { name: 'notesOnly', params: {} },
    });
    await run.apply(addClient, {
      id: 'foldersPeer',
      actorId: 'foldersPeer',
      sessionQuery: { name: 'foldersOnly', params: {} },
    });

    await run.apply(mutate, 'alice', setNote, { id: 'n1', body: 'note-seed' });
    await run.apply(passTime, 400);
    await expectLiveNoteAt(run, 'notesPeer', 'n1', { body: 'note-seed' });
    expect(await run.observe(liveFolders('notesPeer'))).toEqual([]);

    await run.apply(hold, 'notesPeer', 'sync');
    await run.apply(mutate, 'alice', setFolder, { id: 'f1', title: 'Work' });
    await run.apply(passTime, 400);

    // notesOnly ∩ tables=['folders'] = empty → no wake; still no folders.
    expect(await run.observe(liveFolders('notesPeer'))).toEqual([]);
    await expectLiveNoteAt(run, 'notesPeer', 'n1', { body: 'note-seed' });

    // foldersOnly overlaps → wake+refetch brings folder in.
    await run.apply(passTime, 400);
    const folders = await run.observe(liveFolders('foldersPeer'));
    expect(folders.some((f) => f.id === 'f1')).toBe(true);

    await run.apply(release, 'notesPeer', 'sync');
    await run.apply(crash, 'notesPeer');
    await run.apply(crash, 'foldersPeer');
    await run.apply(addClient, 'bob');
    await expectConverged(run);
    expect((await run.observe(liveNotes('server'))).length).toBeGreaterThan(0);
  });
});
