import { describe, test } from 'bun:test';
import {
  expectLiveNote,
  notesDomainPack,
  setNoteNoFanout,
} from '../../domain-packs/notes-app';
import { openSimWorld } from '../../sim/world';

describe('push without affected rows wakes refetch', () => {
  test('mutation without affectedRows converges via wake+refetch with rowImageFanout', async () => {
    // rowImageFanout true: proves pushSeq-only pushes still wake peers when images absent.
    await using world = await openSimWorld({
      domain: notesDomainPack,
      seed: 680,
    });
    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });

    await a.mutate(setNoteNoFanout, { id: 'n1', body: 'no-images' });
    await world.assertConverged();

    await expectLiveNote(b.db, 'n1', { body: 'no-images' });
  });
});
