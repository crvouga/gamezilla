import { expect, test } from 'bun:test';
import { createHarnessClock } from '@pkgs/clock-shared/harness-clock';
import { HttpNetworkError } from '@pkgs/http-client-shared/http-network-error';
import { createHealthOriginAvailability } from '@pkgs/http-client-shared/origin-availability';
import { createOriginAwareFetch } from '@pkgs/http-client-shared/origin-aware-fetch';

// regression: unavailable-origin-parks-interactive-request
test('an unavailable origin answers the caller instead of parking its mutation', async () => {
  const { clock, timers } = createHarnessClock();
  const calls: string[] = [];
  const fetch = async (input: RequestInfo | URL): Promise<Response> => {
    calls.push(String(input));
    throw new HttpNetworkError('service stopped');
  };
  const availability = createHealthOriginAvailability({
    healthUrl: 'http://localhost:5428/api/health',
    fetch,
    clock,
    timers,
  });
  availability.start();
  for (let turn = 0; turn < 8; turn++) await Promise.resolve();
  let outcome: unknown = null;
  const request = createOriginAwareFetch({ fetch, availability })(
    'http://localhost:5428/api/mutations',
    { method: 'POST', body: '{"mutations":[]}' }
  ).catch((error: unknown) => {
    outcome = error;
  });
  try {
    for (let turn = 0; turn < 8; turn++) await Promise.resolve();
    expect(outcome).toBeInstanceOf(HttpNetworkError);
    expect(calls).toEqual(['http://localhost:5428/api/health']);
  } finally {
    availability.stop();
    await request;
  }
});
