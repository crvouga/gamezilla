import { expect, test } from 'bun:test';
import { withFreshConnections } from '@pkgs/http-client-shared-ts/fresh-connection';
import type { HttpClient } from '@pkgs/http-client-shared-ts/types';

// regression: health-runner-reuses-dropped-connection
test('a synthetic-monitor sign-in is never written into an idle pooled connection', async () => {
  const sent: { readonly input: string; readonly init: RequestInit }[] = [];
  const inner: HttpClient = {
    fetch: (input, init) => {
      sent.push({ input: String(input), init: init ?? {} });
      return Promise.resolve(new Response('{}'));
    },
  };
  const http = withFreshConnections(inner);

  await http.fetch('https://api.example.test/api/auth/synthetic-monitor/code', {
    method: 'POST',
    headers: { authorization: 'Bearer token' },
    body: '{"callbackUrl":"https://www.example.test/sso-callback"}',
  });
  await http.fetch('https://api.example.test/api/auth/session', {
    keepalive: true,
  });
  await http.fetch('https://api.example.test/api/health');

  expect(sent.map((request) => request.init.keepalive)).toEqual([
    false,
    false,
    false,
  ]);
  expect(sent[0]).toEqual({
    input: 'https://api.example.test/api/auth/synthetic-monitor/code',
    init: {
      method: 'POST',
      headers: { authorization: 'Bearer token' },
      body: '{"callbackUrl":"https://www.example.test/sso-callback"}',
      keepalive: false,
    },
  });
});
