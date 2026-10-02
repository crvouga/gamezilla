import { expect, test } from 'bun:test';
import { harnessClientServerFetch } from '@libs/harness/fabric/client-server-fetch';
import { harnessPartitionedError } from '@libs/harness/fabric/net';
import { createHarnessClock } from '@pkgs/clock';
import { HttpNetworkError } from '@pkgs/http-client';

test('an offline account request fails as a network error and can resume after health recovers', async () => {
  // regression: harness-offline-account-recovery
  const { clock, timers } = createHarnessClock();
  let online = true;
  const client = harnessClientServerFetch({
    serverUrl: 'https://api.test',
    clock,
    timers,
    fetch: async () => {
      if (!online) throw harnessPartitionedError('alice', 'server-a');
      return Response.json({ status: 'ok' });
    },
  });
  const url = 'https://api.test/api/identity/anon/ensure';
  try {
    client.availability.start();
    for (
      let tick = 0;
      tick < 20 && client.availability.getSnapshot().phase !== 'available';
      tick++
    ) {
      await Promise.resolve();
    }
    expect(client.availability.getSnapshot().phase).toBe('available');
    online = false;
    await expect(client.fetch(url)).rejects.toBeInstanceOf(HttpNetworkError);
    expect(client.availability.getSnapshot().phase).toBe('unavailable');
    let resumed = false;
    const recovery = client.availability.waitUntilAvailable().then(async () => {
      await client.fetch(url);
      resumed = true;
    });
    await Promise.resolve();
    expect(resumed).toBe(false);
    online = true;
    await client.availability.refresh();
    await recovery;
    expect(resumed).toBe(true);
  } finally {
    client.availability.stop();
  }
  expect(clock.nextDueAt()).toBeNull();
});
