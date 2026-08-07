import { describe, test } from 'bun:test';

import { RELIABLE_FAULTS } from '../../sim/faults';
import { expectLiveNote, setNote } from '../../sim/notes-app';
import { openSimWorld } from '../../sim/world';

/** Over MAX_FANOUT_BYTES (32KiB) so fanoutRowsWithinCap drops row images. */
const HUGE_BODY = 'x'.repeat(33 * 1024);

describe('fanout degrade size cap', () => {
  test('oversized row images fall back to pushSeq-only; peers still converge', async () => {
    // rowImageFanout true (default): cap drops images; wake+refetch still converges.
    const world = await openSimWorld({ seed: 670, faults: RELIABLE_FAULTS });
    try {
      const a = await world.addClient({ id: 'alice' });
      const b = await world.addClient({ id: 'bob' });

      await a.mutate(setNote, { id: 'huge', body: HUGE_BODY });
      await world.assertConverged();

      await expectLiveNote(b.db, 'huge', { body: HUGE_BODY });
    } finally {
      await world.dispose();
    }
  });
});
