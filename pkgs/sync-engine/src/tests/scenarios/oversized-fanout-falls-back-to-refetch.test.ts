import { describe, test } from 'bun:test';
import {
  expectLiveNote,
  acmeDomainPack,
  setNote,
} from '../apps/acme';
import { openSimWorld } from '../../sim/world';

/** Over MAX_FANOUT_BYTES (32KiB) so fanoutRowsWithinCap drops row images. */
const HUGE_BODY = 'x'.repeat(33 * 1024);

describe('oversized fanout falls back to refetch', () => {
  test('oversized row images fall back to pushSeq-only; peers still converge', async () => {
    // rowImageFanout true (default): cap drops images; wake+refetch still converges.
    await using world = await openSimWorld({
      domain: acmeDomainPack,
      seed: 670,
    });
    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });

    await a.mutate(setNote, { id: 'huge', body: HUGE_BODY });
    await world.assertConverged();

    await expectLiveNote(b.db, 'huge', { body: HUGE_BODY });
  });
});
