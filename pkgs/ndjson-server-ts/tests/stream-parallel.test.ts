import { expect, test } from 'bun:test';
import { streamParallelIndexed } from '@pkgs/ndjson-server-ts/stream-parallel';
import type { NdjsonFrame } from '@pkgs/ndjson-shared-ts/frames';

// regression: ndjson-undefined-rejection — a unit that rejected with
// `undefined` was read as "no error, no result" and dropped, so the client
// saw a missing slot instead of the unit's failure.
test('a unit rejecting with undefined still yields an error frame', async () => {
  const frames: NdjsonFrame[] = [];
  for await (const frame of streamParallelIndexed(
    1,
    () => Promise.reject(undefined),
    (index) => ({ frame: 'error', index, status: 500, message: 'failed' })
  )) {
    frames.push(frame);
  }
  expect(frames).toEqual([
    { frame: 'error', index: 0, status: 500, message: 'failed' },
    { frame: 'end' },
  ]);
});
