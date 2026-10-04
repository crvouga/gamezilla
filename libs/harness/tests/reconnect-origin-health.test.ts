import { expect, test } from 'bun:test';
import type { ClientEnv } from '@libs/app-client/client-env';
import { setOriginAvailability } from '@libs/app-client/origin-availability-for-env';
import { restoreActorConnection, restoreNetwork } from '@libs/harness/actions';
import { harnessClientServerFetch } from '@libs/harness/client-server-fetch';
import type { ProductHarness } from '@libs/harness/harness';
import { harnessPartitionedError } from '@libs/harness/net';
import { HARNESS_PRIMARY_SERVER_ID } from '@libs/harness/server-nodes';
import { createHarnessClock } from '@pkgs/clock-shared/harness-clock';

async function flush(): Promise<void> {
  for (let turn = 0; turn < 20; turn++) await Promise.resolve();
}

// regression: harness-reconnect-origin-health — puzzle trace 46, seed 0x67932.
// regression: harness-reconnect-stale-fabric-fixture
test.each(['one', 'all'] as const)(
  'reconnecting %s wakes an offline boot before its backed-off probe',
  async (scope) => {
    const { clock, timers } = createHarnessClock({ startMs: 12_400 });
    let reachable = false;
    const server = harnessClientServerFetch({
      serverUrl: 'https://api.test',
      clock,
      timers,
      fetch: async () => {
        if (!reachable)
          throw harnessPartitionedError('charlie', HARNESS_PRIMARY_SERVER_ID);
        return Response.json({ status: 'ok' });
      },
    });
    const env = {} as ClientEnv;
    setOriginAvailability(env, server.availability);
    const fabricHeals: string[][] = [];
    const s = {
      actors: new Map([['charlie', {}]]),
      harness: {
        client: async () => env,
        heal: (...ids: string[]) => fabricHeals.push(ids),
      },
      session: {
        network: {
          heal: (serverId: string, actor: string) => {
            expect([serverId, actor]).toEqual([
              HARNESS_PRIMARY_SERVER_ID,
              'charlie',
            ]);
            reachable = true;
          },
          healAll: () => {
            reachable = true;
          },
        },
      },
    } as unknown as ProductHarness;
    server.availability.start();
    try {
      await flush();
      for (const delay of [1_000, 2_000, 4_000, 8_000, 16_000]) {
        clock.advance(delay);
        await flush();
      }
      expect(clock.nextDueAt()! - clock.now()).toBe(30_000);
      let resumed = false;
      const recovery = server.availability.waitUntilAvailable().then(() => {
        resumed = true;
      });
      if (scope === 'one')
        await Promise.resolve(restoreActorConnection.act(s, 'charlie'));
      else await Promise.resolve(restoreNetwork.act(s));
      expect(fabricHeals).toEqual(
        scope === 'one' ? [[HARNESS_PRIMARY_SERVER_ID, 'charlie']] : [[]]
      );
      expect(server.availability.getSnapshot().phase).toBe('available');
      await recovery;
      expect(resumed).toBe(true);
    } finally {
      server.availability.stop();
    }
    expect(clock.nextDueAt()).toBeNull();
  }
);
