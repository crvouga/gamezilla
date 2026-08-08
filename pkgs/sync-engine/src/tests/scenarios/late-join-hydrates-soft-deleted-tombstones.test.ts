import { describe, expect, test } from 'bun:test';
import {
  deleteNote,
  expectNoteNotLive,
  notesDomainPack,
  readNoteTombstone,
  setNote,
} from '../../domain-packs/notes-app';
import { openSimWorld } from '../../sim/world';

describe('late join hydrates soft deleted tombstones', () => {
  test('peer that joins after delete gets tombstone from snapshot', async () => {
    await using world = await openSimWorld({
      domain: notesDomainPack,
      seed: 511,
    });
    const a = await world.addClient({ id: 'alice' });
    await a.mutate(setNote, { id: 'n1', body: 'gone' });
    await world.assertConverged();
    await a.mutate(deleteNote, { id: 'n1' });
    await world.assertConverged();

    const c = await world.addClient({ id: 'charlie' });
    await expectNoteNotLive(c.db, 'n1');
    const tomb = await readNoteTombstone(c.db, 'n1');
    expect(tomb).not.toBeNull();
  });
});
