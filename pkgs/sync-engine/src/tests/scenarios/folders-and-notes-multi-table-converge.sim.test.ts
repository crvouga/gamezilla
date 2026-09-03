import { describe, expect, test } from 'bun:test';
import { script } from '@pkgs/dst';
import {
  acmeKnobs,
  acmeSystem,
  addClient,
  deleteFolder,
  expectConverged,
  expectLiveNoteAt,
  liveFolders,
  liveNotes,
  moveNote,
  mutate,
  setFolder,
  setNote,
  syncVirtualHost,
} from '../apps/acme';

describe('folders and notes multi table converge', () => {
  test('folder + note hydrate on peer', async () => {
    await using run = await script(acmeSystem, {
      seed: 20,
      host: syncVirtualHost(),
      knobs: acmeKnobs({ clientCount: 0 }),
      properties: [],
    });

    await run.apply(addClient, { id: 'alice' });
    await run.apply(addClient, { id: 'bob' });

    await run.apply(mutate, 'alice', setFolder, { id: 'f1', title: 'Work' });
    await run.apply(mutate, 'alice', setNote, {
      id: 'n1',
      body: 'todo',
      folderId: 'f1',
      title: 'Task',
    });
    await expectConverged(run);

    expect(await run.observe(liveFolders('bob'))).toEqual([
      { id: 'f1', title: 'Work', ownerId: 'alice' },
    ]);
    await expectLiveNoteAt(run, 'bob', 'n1', { body: 'todo', title: 'Task' });
    const notes = await run.observe(liveNotes('bob'));
    expect(notes[0]?.folderId).toBe('f1');
  });

  test('moveNote updates folder_id on peers', async () => {
    await using run = await script(acmeSystem, {
      seed: 21,
      host: syncVirtualHost(),
      knobs: acmeKnobs({ clientCount: 0 }),
      properties: [],
    });

    await run.apply(addClient, { id: 'alice' });
    await run.apply(addClient, { id: 'bob' });

    await run.apply(mutate, 'alice', setFolder, { id: 'f1', title: 'A' });
    await run.apply(mutate, 'alice', setFolder, { id: 'f2', title: 'B' });
    await run.apply(mutate, 'alice', setNote, {
      id: 'n1',
      body: 'x',
      folderId: 'f1',
    });
    await expectConverged(run);

    await run.apply(mutate, 'alice', moveNote, { id: 'n1', folderId: 'f2' });
    await expectConverged(run);

    const notes = await run.observe(liveNotes('bob'));
    expect(notes.find((n) => n.id === 'n1')?.folderId).toBe('f2');
  });

  test('deleteFolder soft-deletes folder; notes remain', async () => {
    await using run = await script(acmeSystem, {
      seed: 22,
      host: syncVirtualHost(),
      knobs: acmeKnobs({ clientCount: 0 }),
      properties: [],
    });

    await run.apply(addClient, { id: 'alice' });
    await run.apply(addClient, { id: 'bob' });

    await run.apply(mutate, 'alice', setFolder, { id: 'f1', title: 'Temp' });
    await run.apply(mutate, 'alice', setNote, {
      id: 'n1',
      body: 'orphan-ok',
      folderId: 'f1',
    });
    await expectConverged(run);

    await run.apply(mutate, 'alice', deleteFolder, { id: 'f1' });
    await expectConverged(run);

    expect(await run.observe(liveFolders('bob'))).toEqual([]);
    await expectLiveNoteAt(run, 'bob', 'n1', { body: 'orphan-ok' });
  });
});
