import { describe, test } from 'bun:test';
import { openWorld } from '@pkgs/determinism';
import { syncFacade } from '../../sim/system';
import { expectLiveNote, setNote } from '../apps/acme';
import { acmeSystem } from '../apps/acme/system';

/** Over MAX_FANOUT_BYTES (32KiB) so fanoutRowsWithinCap drops row images. */
const HUGE_BODY = 'x'.repeat(33 * 1024);

describe('oversized fanout falls back to refetch', () => {
  test('oversized row images fall back to pushSeq-only; peers still converge', async () => {
    // rowImageFanout true (default): cap drops images; wake+refetch still converges.
    await using host = await openWorld(acmeSystem, {
      seed: 670,
      knobs: {
        clientCount: 0,
      },
    });
    const world = syncFacade(host.system);
    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });

    await a.mutate(setNote, { id: 'huge', body: HUGE_BODY });
    await world.assertConverged();

    await expectLiveNote(b.db, 'huge', { body: HUGE_BODY });
  });
});
