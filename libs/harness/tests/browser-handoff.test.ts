import { expect, test } from 'bun:test';
import { createHarnessBrowser } from '@libs/harness/browser';

// regression: oauth-document-handoff-not-followed
test('the actor browser finishes a cross-origin HTML callback without a second form submission', async () => {
  const callback = 'https://app.example.invalid/sso-callback';
  const browser = createHarnessBrowser({
    appOrigin: () => 'https://app.example.invalid',
    network: () =>
      Promise.resolve(
        new Response('<a>Return to the app</a>', {
          headers: {
            'content-type': 'text/html',
            refresh: `0;url=${callback}?code=accepted`,
          },
        })
      ),
  });
  expect(
    await browser.openAuthSession(
      'https://api.example.invalid/auth/callback/google',
      callback
    )
  ).toEqual({ type: 'success', url: `${callback}?code=accepted` });
  await Promise.resolve();
  expect(browser.tab()).toBeNull();
});

test('a relayed form post keeps its fields before the document refresh begins a GET', async () => {
  const requests: {
    url: string;
    method: string;
    body: BodyInit | null | undefined;
  }[] = [];
  const callback = 'https://app.example.invalid/sso-callback';
  const browser = createHarnessBrowser({
    appOrigin: () => 'https://app.example.invalid',
    network: (url, init) => {
      requests.push({
        url: String(url),
        method: init?.method ?? 'GET',
        body: init?.body,
      });
      if (String(url).endsWith('/launch'))
        return Promise.resolve(
          new Response('<form></form>', {
            headers: { 'content-type': 'text/html' },
          })
        );
      if (String(url).includes('relay.example.invalid'))
        return Promise.resolve(
          new Response(null, {
            status: 307,
            headers: {
              location: 'https://api.example.invalid/auth/callback/apple',
            },
          })
        );
      return Promise.resolve(
        new Response(null, {
          headers: {
            'content-type': 'text/html',
            refresh: `0;url=${callback}?code=accepted`,
          },
        })
      );
    },
  });
  const result = browser.openAuthSession(
    'https://api.example.invalid/launch',
    callback
  );
  browser.post('https://relay.example.invalid/auth/callback/apple', {
    state: 'dev-state',
    code: 'provider-code',
  });
  expect(await result).toEqual({
    type: 'success',
    url: `${callback}?code=accepted`,
  });
  expect(requests.filter(({ method }) => method === 'POST')).toEqual([
    {
      url: 'https://relay.example.invalid/auth/callback/apple',
      method: 'POST',
      body: 'state=dev-state&code=provider-code',
    },
    {
      url: 'https://api.example.invalid/auth/callback/apple',
      method: 'POST',
      body: 'state=dev-state&code=provider-code',
    },
  ]);
});
