import { describe, expect, test } from 'bun:test';
import { openWorld } from '../../sim/world';
import {
  acmeDomainPack,
  deleteFolder,
  expectFoldersMatchServer,
  expectLiveNote,
  moveNote,
  readLiveFolders,
  readLiveNotes,
  setFolder,
  setNote,
} from '../apps/acme';

describe('folders and notes multi table converge', () => {
  test('folder + note hydrate on peer', async () => {
    await using world = await openWorld({
      domain: acmeDomainPack,
      seed: 20,
    });
    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });

    await a.mutate(setFolder, { id: 'f1', title: 'Work' });
    await a.mutate(setNote, {
      id: 'n1',
      body: 'todo',
      folderId: 'f1',
      title: 'Task',
    });
    await world.assertConverged();

    const folders = await readLiveFolders(b.db);
    expect(folders).toEqual([{ id: 'f1', title: 'Work', owner_id: 'alice' }]);
    await expectLiveNote(b.db, 'n1', { body: 'todo', title: 'Task' });
    const notes = await readLiveNotes(b.db);
    expect(notes[0]?.folder_id).toBe('f1');
    await expectFoldersMatchServer(b.db, world.server.db);
  });

  test('moveNote updates folder_id on peers', async () => {
    await using world = await openWorld({
      domain: acmeDomainPack,
      seed: 21,
    });
    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });

    await a.mutate(setFolder, { id: 'f1', title: 'A' });
    await a.mutate(setFolder, { id: 'f2', title: 'B' });
    await a.mutate(setNote, {
      id: 'n1',
      body: 'x',
      folderId: 'f1',
    });
    await world.assertConverged();

    await a.mutate(moveNote, { id: 'n1', folderId: 'f2' });
    await world.assertConverged();

    const notes = await readLiveNotes(b.db);
    expect(notes.find((n) => n.id === 'n1')?.folder_id).toBe('f2');
  });

  test('deleteFolder soft-deletes folder; notes remain', async () => {
    await using world = await openWorld({
      domain: acmeDomainPack,
      seed: 22,
    });
    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });

    await a.mutate(setFolder, { id: 'f1', title: 'Temp' });
    await a.mutate(setNote, {
      id: 'n1',
      body: 'orphan-ok',
      folderId: 'f1',
    });
    await world.assertConverged();

    await a.mutate(deleteFolder, { id: 'f1' });
    await world.assertConverged();

    expect(await readLiveFolders(b.db)).toEqual([]);
    await expectLiveNote(b.db, 'n1', { body: 'orphan-ok' });
  });
});
