import { expect, test } from 'bun:test';
import { createAuthenticatedFetch } from '@libs/client-app/shell/create-authenticated-fetch';

// regression: avatar-tts-missing-request-auth
test('speech requests carry current identity while preserving cancellation and custom headers', async () => {
  let token: string | null = null;
  const auth = {
    get sessionToken() {
      return token;
    },
    deviceId: 'device-a',
    accountId: 'account-a',
  };
  const requests: RequestInit[] = [];
  const fetch = createAuthenticatedFetch((_input, init) => {
    requests.push(init ?? {});
    return Promise.resolve(new Response());
  }, auth);
  const controller = new AbortController();
  await fetch('/api/tts/synthesize', {
    method: 'POST',
    headers: { 'x-trace': 'trace-a' },
    signal: controller.signal,
  });
  expect(new Headers(requests[0]?.headers).get('x-anon-id')).toBe('device-a');
  token = 'session-a';
  await fetch('/api/tts/synthesize', {
    method: 'POST',
    headers: { 'x-trace': 'trace-a' },
    signal: controller.signal,
  });
  const headers = new Headers(requests[1]?.headers);
  expect(headers.get('authorization')).toBe('Bearer session-a');
  expect(headers.get('x-trace')).toBe('trace-a');
  expect(requests[1]?.signal).toBe(controller.signal);
});
