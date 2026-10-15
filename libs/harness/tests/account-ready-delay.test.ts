import { expect, test } from 'bun:test';
import {
  accountReadyDelayFetch,
  createHarnessAccountReadyDelays,
} from '@libs/harness/account-ready-delay';
import { createHarnessClock } from '@pkgs/clock-shared/harness-clock';
import { createDeadlineFetch } from '@pkgs/http-client-shared/deadline-fetch';
import { HttpNetworkError } from '@pkgs/http-client-shared/http-network-error';

// regression: account-readiness-delay-restarts-on-retry
test('a ten-second account setup remains ready after the request deadline and device reopening', async () => {
  const { clock, timers } = createHarnessClock();
  const delays = createHarnessAccountReadyDelays();
  delays.set('alice_phone', 10_000);
  const reopen = () =>
    createDeadlineFetch({
      timers,
      fetch: accountReadyDelayFetch({
        delays,
        clientId: 'alice_phone',
        timers,
        inner: () => Promise.resolve(Response.json({ accountId: 'alice' })),
      }),
    });
  const url = 'https://api.example.invalid/api/identity/refresh';
  const init = {
    method: 'POST',
    headers: { Authorization: 'Bearer account-session' },
  };
  const first = reopen()(url, init).catch((error: unknown) => error);
  clock.advance(10_000);
  expect(await first).toBeInstanceOf(HttpNetworkError);
  let ready = false;
  const second = reopen()(url, init).then(async (response) => {
    expect(await response.json()).toEqual({ accountId: 'alice' });
    ready = true;
  });
  for (let turn = 0; turn < 20; turn++) await Promise.resolve();
  expect(ready).toBe(true);
  await second;
  expect(clock.nextDueAt()).toBeNull();
});
