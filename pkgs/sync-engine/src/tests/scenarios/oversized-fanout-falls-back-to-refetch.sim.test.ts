import { describe, expect, test } from 'bun:test';
import {
  acmeSystem,
  addClient,
  expectConverged,
  liveNote,
  mutate,
  setNote,
} from '../apps/acme';

/** Over MAX_FANOUT_BYTES (32KiB) so fanoutRowsWithinCap drops row images. */
const HUGE_BODY = 'x'.repeat(33 * 1024);

describe('oversized fanout falls back to refetch', () => {
  test('oversized row images fall back to pushSeq-only; peers still converge', async () => {
    // rowImageFanout true (default): cap drops images; wake+refetch still converges.
    await using s = await acmeSystem.script({
      seed: 670,
      args: { clientCount: 0 },
    });

    await s.apply(addClient, 'alice');
    await s.apply(addClient, 'bob');

    await s.apply(mutate, 'alice', setNote, { id: 'huge', body: HUGE_BODY });
    await expectConverged(s);

    expect(await s.observe(liveNote, 'bob', 'huge')).toMatchObject({
      body: HUGE_BODY,
    });
  });
});
