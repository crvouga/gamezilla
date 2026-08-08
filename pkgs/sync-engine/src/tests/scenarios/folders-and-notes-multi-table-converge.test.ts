import { describe, expect, test } from 'bun:test';
import {
  deleteFolder,
  expectFoldersMatchServer,
  expectLiveNote,
  moveNote,
  notesDomainPack,
  readLiveFolders,
  readLiveNotes,
  setFolder,
  setNote,
} from '../../domain-packs/notes-app';
import { RELIABLE_FAULTS } from '../../sim/faults';
import { openSimWorld } from '../../sim/world';

describe('folders and notes multi table converge', () => {
  test('folder + note hydrate on peer', async () => {
    const world = await openSimWorld({
      domain: notesDomainPack,
      seed: 20,
      faults: RELIABLE_FAULTS,
    });
    try {
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
    } finally {
      await world.dispose();
    }
  });

  test('moveNote updates folder_id on peers', async () => {
    const world = await openSimWorld({
      domain: notesDomainPack,
      seed: 21,
      faults: RELIABLE_FAULTS,
    });
    try {
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
    } finally {
      await world.dispose();
    }
  });

  test('deleteFolder soft-deletes folder; notes remain', async () => {
    const world = await openSimWorld({
      domain: notesDomainPack,
      seed: 22,
      faults: RELIABLE_FAULTS,
    });
    try {
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
    } finally {
      await world.dispose();
    }
  });
});
