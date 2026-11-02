import { expect, test } from 'bun:test';
import { createPreviewHttp } from '@pkgs/workspace-preview-client-ts/http';
import { resolveBrowserPreviewUrl } from '@pkgs/workspace-preview-client-ts/url';

const ORIGIN = 'https://efforts-essentially-rules-treasury.trycloudflare.com';
const options = {
  origin: ORIGIN,
  mapUrl: (url: string) =>
    resolveBrowserPreviewUrl(url, ORIGIN, [
      { origin: 'http://localhost:39803', prefix: '/_preview/s3' },
    ]),
};

// regression: preview-authenticated-subrequests
test('protected preview requests include the gateway cookie even for anonymous feedback uploads', async () => {
  const calls: Request[] = [];
  const credentials: (RequestCredentials | undefined)[] = [];
  const http = createPreviewHttp(
    {
      fetch: async (input, init) => {
        calls.push(new Request(input, init));
        credentials.push(init?.credentials);
        return new Response('ok');
      },
    },
    options
  );
  for (const input of [
    `${ORIGIN}/api/health`,
    `${ORIGIN}/@fs/home/crvouga/.t3/worktrees/gamezilla/t3-8a15e894/pkgs/sounds-shared-ts/assets/feedback/error.mp3`,
    new Request('http://localhost:39803/bucket/key?signature=a%2Bb', {
      method: 'PUT',
      body: 'signed bytes',
      credentials: 'omit',
    }),
  ])
    await http.fetch(input, { credentials: 'omit' });
  expect(credentials).toEqual(['same-origin', 'same-origin', 'same-origin']);
  expect(calls[2]?.url).toBe(
    `${ORIGIN}/_preview/s3/bucket/key?signature=a%2Bb`
  );
  expect(await calls[2]?.text()).toBe('signed bytes');
});

// regression: preview-authentication-cors-redirect
test('a lost preview session stops at the gateway redirect with a recovery action', async () => {
  const http = createPreviewHttp(
    {
      fetch: async (_input, init) => {
        expect(init?.redirect).toBe('manual');
        return { type: 'opaqueredirect' } as Response;
      },
    },
    options
  );
  await expect(http.fetch(`${ORIGIN}/api/health`)).rejects.toThrow(
    'email sign-in'
  );
});

test('unrelated external requests keep their credential and redirect policy', async () => {
  const init: RequestInit = { credentials: 'omit', redirect: 'error' };
  const http = createPreviewHttp(
    {
      fetch: async (input, actual) => {
        expect(input).toBe('https://external.example/data');
        expect(actual).toBe(init);
        return new Response('external');
      },
    },
    options
  );
  expect(
    await (await http.fetch('https://external.example/data', init)).text()
  ).toBe('external');
});
