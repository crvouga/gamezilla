import { assert } from '@pkgs/assert';
import type { Clock } from '@pkgs/clock';

export function createSimClock(
  startMs = 0
): Clock & { advance(ms: number): void } {
  assert.ok(Number.isFinite(startMs), 'startMs finite');
  let now = startMs;
  return {
    now: () => now,
    advance(ms: number) {
      assert.ok(ms >= 0, 'advance >= 0');
      now += ms;
    },
  };
}
