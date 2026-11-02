import { expect, test } from 'bun:test';
import {
  resolveBrowserPreviewRequest,
  resolveBrowserPreviewUrl,
} from '@pkgs/workspace-preview-client-ts/url';

const ORIGIN = 'https://preview.example.test';
const ROUTES = [
  { origin: 'http://localhost:8040', prefix: '/_preview/s3' },
  { origin: 'ws://127.0.0.1:8041', prefix: '/_preview/mqtt' },
];

test('browser transports resolve only this boot’s declared services', () => {
  expect(
    resolveBrowserPreviewUrl(
      'http://127.0.0.1:8040/bucket/key?signature=a%2Bb',
      ORIGIN,
      ROUTES
    )
  ).toBe(`${ORIGIN}/_preview/s3/bucket/key?signature=a%2Bb`);
  expect(
    resolveBrowserPreviewUrl('ws://localhost:8041/mqtt', ORIGIN, ROUTES)
  ).toBe('wss://preview.example.test/_preview/mqtt/mqtt');
  for (const url of [
    'https://outside.example/path',
    'http://localhost:9999/private',
    '/api/query',
  ])
    expect(resolveBrowserPreviewUrl(url, ORIGIN, ROUTES)).toBe(url);
});

// regression: workspace-preview-payload-rewrite
test('mapping a signed upload request changes its destination without changing its body or headers', async () => {
  const body = '{"url":"http://localhost:8040/stays-unchanged"}\n';
  const original = new Request(
    'http://localhost:8040/bucket/key?signature=a%2Bb',
    {
      method: 'PUT',
      body,
      headers: { 'x-amz-content-sha256': 'original-hash' },
    }
  );
  const mapped = await resolveBrowserPreviewRequest(original, (url) =>
    resolveBrowserPreviewUrl(url, ORIGIN, ROUTES)
  );
  if (!(mapped instanceof Request))
    throw new Error('Expected a mapped request');
  expect(mapped.url).toBe(`${ORIGIN}/_preview/s3/bucket/key?signature=a%2Bb`);
  expect(mapped.method).toBe('PUT');
  expect(mapped.headers.get('x-amz-content-sha256')).toBe('original-hash');
  const mappedBody = await mapped.text();
  expect(mappedBody).toBe(body);
  const unchanged = new Request(`${ORIGIN}/api/query`);
  expect(resolveBrowserPreviewRequest(unchanged, (url) => url)).toBe(unchanged);
});

test('a caller-supplied replacement body does not consume the original request body', async () => {
  const input = new Request('http://localhost:8040/key', {
    method: 'PUT',
    body: 'original',
  });
  const init = { body: 'replacement' };
  const result = await resolveBrowserPreviewRequest(
    input,
    (url) => resolveBrowserPreviewUrl(url, ORIGIN, ROUTES),
    init
  );
  expect(input.bodyUsed).toBe(false);
  const replacedBody = await new Request(result, init).text();
  expect(replacedBody).toBe('replacement');
});
