import { expect, test } from 'bun:test';
import type { ProductHarness } from '@libs/harness/harness';
import { restoreSpaceConnection } from '@libs/spaces-harness/space-idle-actions';
import { createHarnessClock } from '@pkgs/clock-shared/harness-clock';

function reconnectRig(previousAt: number, deliveryMs: number) {
  const { clock } = createHarnessClock({ startMs: 1000 });
  let activityAt = previousAt;
  let returnedAt: number | undefined;
  const s = {
    actors: new Map([
      [
        'alice',
        {
          ui: {
            get: () => ({
              layout: async () => null,
              text: async () => String(activityAt),
            }),
          },
        },
      ],
    ]),
    harness: { client: async () => ({}), heal: () => {} },
    session: {
      ports: { clock },
      network: {
        heal: () => {
          returnedAt = clock.now();
          if (deliveryMs === 0) activityAt = returnedAt;
        },
      },
      advanceTime: async (ms: number) => {
        clock.advance(ms);
        if (returnedAt !== undefined && clock.now() >= returnedAt + deliveryMs)
          activityAt = returnedAt;
      },
      waitForIdle: async () => {},
      scheduler: { starvedAdvances: () => 0 },
    },
  } as unknown as ProductHarness;
  return { s, clock };
}

test('reconnection in the same clock tick accepts already-current activity', async () => {
  // regression: space-reconnect-same-tick-activity
  const { s, clock } = reconnectRig(1000, 0);
  await Promise.resolve(restoreSpaceConnection.act(s, 'alice'));
  expect(clock.now()).toBe(1000);
});

test.each([0, 100, 300, 1000])(
  'reconnection waits for current activity delivered after %i virtual milliseconds',
  async (deliveryMs) => {
    const { s, clock } = reconnectRig(999, deliveryMs);
    await Promise.resolve(restoreSpaceConnection.act(s, 'alice'));
    expect(clock.now()).toBe(1000 + deliveryMs);
  }
);
