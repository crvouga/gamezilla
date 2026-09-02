import { describe, expect, test } from 'bun:test';
import {
  deleteNote,
  expectNoteNotLive,
  readNoteTombstone,
  setNote,
} from '../apps/acme';
import { openAcmeWorld } from '../apps/acme/system';

describe('late join hydrates soft deleted tombstones', () => {
  test('peer that joins after delete gets tombstone from snapshot', async () => {
    await using world = await openAcmeWorld({
      seed: 511,
      knobs: {
        clientCount: 0,
      },
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
