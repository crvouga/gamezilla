import { describe, expect, test } from 'bun:test';
import {
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
} from '../apps/acme';

describe('folders and notes multi table converge', () => {
  test('folder + note hydrate on peer', async () => {
    await using s = await acmeSystem.script({
      seed: 20,
      args: { clientCount: 0 },
    });

    await s.apply(addClient, { id: 'alice' });
    await s.apply(addClient, { id: 'bob' });

    await s.apply(mutate, 'alice', setFolder, { id: 'f1', title: 'Work' });
    await s.apply(mutate, 'alice', setNote, {
      id: 'n1',
      body: 'todo',
      folderId: 'f1',
      title: 'Task',
    });
    await expectConverged(s);

    expect(await s.observe(liveFolders, 'bob')).toEqual([
      { id: 'f1', title: 'Work', ownerId: 'alice' },
    ]);
    await expectLiveNoteAt(s, 'bob', 'n1', { body: 'todo', title: 'Task' });
    const notes = await s.observe(liveNotes, 'bob');
    expect(notes[0]?.folderId).toBe('f1');
  });

  test('moveNote updates folder_id on peers', async () => {
    await using s = await acmeSystem.script({
      seed: 21,
      args: { clientCount: 0 },
    });

    await s.apply(addClient, { id: 'alice' });
    await s.apply(addClient, { id: 'bob' });

    await s.apply(mutate, 'alice', setFolder, { id: 'f1', title: 'A' });
    await s.apply(mutate, 'alice', setFolder, { id: 'f2', title: 'B' });
    await s.apply(mutate, 'alice', setNote, {
      id: 'n1',
      body: 'x',
      folderId: 'f1',
    });
    await expectConverged(s);

    await s.apply(mutate, 'alice', moveNote, { id: 'n1', folderId: 'f2' });
    await expectConverged(s);

    const notes = await s.observe(liveNotes, 'bob');
    expect(notes.find((n) => n.id === 'n1')?.folderId).toBe('f2');
  });

  test('deleteFolder soft-deletes folder; notes remain', async () => {
    await using s = await acmeSystem.script({
      seed: 22,
      args: { clientCount: 0 },
    });

    await s.apply(addClient, { id: 'alice' });
    await s.apply(addClient, { id: 'bob' });

    await s.apply(mutate, 'alice', setFolder, { id: 'f1', title: 'Temp' });
    await s.apply(mutate, 'alice', setNote, {
      id: 'n1',
      body: 'orphan-ok',
      folderId: 'f1',
    });
    await expectConverged(s);

    await s.apply(mutate, 'alice', deleteFolder, { id: 'f1' });
    await expectConverged(s);

    expect(await s.observe(liveFolders, 'bob')).toEqual([]);
    await expectLiveNoteAt(s, 'bob', 'n1', { body: 'orphan-ok' });
  });
});
