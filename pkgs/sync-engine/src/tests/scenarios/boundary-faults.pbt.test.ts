import { describe, expect, test } from 'bun:test';

import { walkThenConverge } from '../apps/acme/walk-converge';

const ARGS = [
  { rowImageFanout: true, liveResendOnReconnect: false },
  { rowImageFanout: false, liveResendOnReconnect: true },
  { bufferOutboundLive: true },
] as const;

describe('boundary faults PBT', () => {
  test(
    'HTTP fault arms interleaved with mutates converge on heal',
    async () => {
      let armed = 0;
      for (const [i, args] of ARGS.entries()) {
        const walk = await walkThenConverge({
          seed: 100 + i,
          args,
          actions: ['armHttpFault', 'domain', 'restart', 'heal'],
          steps: 10,
        });
        armed += walk.coverage.actions['armHttpFault'] ?? 0;
      }
      expect(armed).toBeGreaterThan(0);
    },
    { timeout: 120_000 }
  );

  test(
    'publishFault arms interleaved with mutates converge on heal',
    async () => {
      for (const [i, args] of ARGS.entries()) {
        await walkThenConverge({
          seed: 200 + i,
          args,
          actions: ['publishFault', 'domain', 'heal'],
          steps: 10,
        });
      }
    },
    { timeout: 90_000 }
  );

  test(
    'crash arms interleaved with mutates converge after restart',
    async () => {
      let armed = 0;
      for (const [i, args] of ARGS.entries()) {
        const walk = await walkThenConverge({
          seed: 300 + i,
          args: { ...args, clientCount: 1 },
          actions: ['armCrashAt', 'domain', 'restart', 'connect', 'heal'],
          steps: 10,
        });
        armed += walk.coverage.actions['armCrashAt'] ?? 0;
      }
      expect(armed).toBeGreaterThan(0);
    },
    { timeout: 120_000 }
  );
});
