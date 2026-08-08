import { describe, test } from 'bun:test';

import { RELIABLE_FAULTS } from '../../sim/faults';
import { expectLiveNote, setNoteNoFanout } from '../../sim/notes-app';
import { openSimWorld } from '../../sim/world';

describe('push without affected rows wakes refetch', () => {
  test('mutation without affectedRows converges via wake+refetch with rowImageFanout', async () => {
    // rowImageFanout true: proves pushSeq-only pushes still wake peers when images absent.
    const world = await openSimWorld({ seed: 680, faults: RELIABLE_FAULTS });
    try {
      const a = await world.addClient({ id: 'alice' });
      const b = await world.addClient({ id: 'bob' });

      await a.mutate(setNoteNoFanout, { id: 'n1', body: 'no-images' });
      await world.assertConverged();

      await expectLiveNote(b.db, 'n1', { body: 'no-images' });
    } finally {
      await world.dispose();
    }
  });
});
