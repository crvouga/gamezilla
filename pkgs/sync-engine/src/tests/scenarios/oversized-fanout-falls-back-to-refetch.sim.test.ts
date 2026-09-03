import { describe, expect, test } from 'bun:test';
import { start } from '@pkgs/dst';
import {
  acmeDraws,
  acmeSystem,
  addClient,
  converge,
  liveNote,
  mutate,
  setNote,
  syncVirtualHost,
} from '../apps/acme';

/** Over MAX_FANOUT_BYTES (32KiB) so fanoutRowsWithinCap drops row images. */
const HUGE_BODY = 'x'.repeat(33 * 1024);

describe('oversized fanout falls back to refetch', () => {
  test('oversized row images fall back to pushSeq-only; peers still converge', async () => {
    // rowImageFanout true (default): cap drops images; wake+refetch still converges.
    await using run = await start(acmeSystem, {
      seed: 670,
      host: syncVirtualHost(),
      draws: acmeDraws({ clientCount: 0 }),
      properties: [],
    });

    await run.apply(addClient, 'alice');
    await run.apply(addClient, 'bob');

    await run.apply(mutate, 'alice', setNote, { id: 'huge', body: HUGE_BODY });
    await run.apply(converge);

    expect(await run.observe(liveNote('bob', 'huge'))).toMatchObject({
      body: HUGE_BODY,
    });
  });
});
