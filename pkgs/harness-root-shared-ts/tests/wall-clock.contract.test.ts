import { expect, test } from 'bun:test';
import { wallTimers } from '@pkgs/clock-shared-ts/wall';
import { realTimeRuntime } from '@pkgs/harness-root-shared-ts/real-time-runtime';

test('a wall session clock progresses without advancing its scheduler', async () => {
  // regression: wall-session-clock-stalls
  const session = await realTimeRuntime({ network: 'none' }).open(41);
  try {
    const before = session.ports.clock.now();
    await new Promise<void>((resolve) => wallTimers.setTimeout(resolve, 10));
    expect(session.ports.clock.now()).toBeGreaterThan(before);
  } finally {
    await session.dispose();
  }
});
