import { expect, test } from 'bun:test';
import { connectPostgresProbe } from '@pkgs/sql-client-postgres-server-ts/ping';

// regression: release-schema-probe-connection-reset
test('a reset during open yields a fresh session for the schema check', async () => {
  const reset = Object.assign(new Error('read ECONNRESET'), {
    code: 'ECONNRESET',
  });
  const delays: number[] = [];
  const timers = {
    setTimeout(fn: () => void, ms: number) {
      delays.push(ms);
      fn();
    },
  };
  const session = { connected: true };
  let attempts = 0;
  const result = await connectPostgresProbe(async () => {
    if (++attempts === 1) throw reset;
    return session;
  }, timers);
  expect(result).toBe(session);
  expect(delays).toEqual([500]);
  delays.length = 0;
  await expect(
    connectPostgresProbe(async () => {
      throw reset;
    }, timers)
  ).rejects.toBe(reset);
  expect(delays).toEqual([500, 1000, 2000, 4000]);
  delays.length = 0;
  const denied = new Error('password authentication failed');
  await expect(
    connectPostgresProbe(async () => {
      throw denied;
    }, timers)
  ).rejects.toBe(denied);
  expect(delays).toEqual([]);
});
