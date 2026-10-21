import { expect, test } from 'bun:test';
import { shutdownSyntheticPopulationWorker } from '@apps/synthetic-population-worker-ts/shutdown';

test.each([
  { drainFails: false, flushFails: false, code: 0 },
  { drainFails: true, flushFails: false, code: 1 },
  { drainFails: false, flushFails: true, code: 1 },
  { drainFails: true, flushFails: true, code: 1 },
])(
  'shutdown completes when drain=$drainFails and flush=$flushFails fail',
  async (input) => {
    const calls: string[] = [];
    await shutdownSyntheticPopulationWorker(
      async () => {
        calls.push('drain');
        if (input.drainFails) throw new Error('database unavailable');
      },
      async () => {
        calls.push('flush');
        if (input.flushFails) throw new Error('collector unavailable');
      },
      (code) => calls.push(`exit:${code}`)
    );
    expect(calls).toEqual(['drain', 'flush', `exit:${input.code}`]);
  }
);
