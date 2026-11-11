import { expect, test } from 'bun:test';
import type { HttpFetch } from '@pkgs/http-client-shared-ts/types';
import {
  entryScripts,
  parsePreviewManifest,
  runPreviewChecks,
} from '../src/preview-checks';

const ORIGIN = 'https://pr-7-acme-preview.acme.workers.dev';
const SHELL =
  '<!doctype html><div id="root"></div><script type="module" crossorigin src="/assets/index-abc.js"></script>';

type Site = Readonly<Record<string, readonly [string, string]>>;

const GOOD: Site = {
  '/assets/index-abc.js': ['text/javascript', 'export {}'],
  '/preview.json': [
    'application/json',
    JSON.stringify({ preview: 'pr-7', commit: 'a'.repeat(40) }),
  ],
};

/** Static hosting with the single-page fallback: a missing path is the shell. */
function staticSite(files: Site, shell: string = SHELL): HttpFetch {
  return async (input) => {
    const file = files[new URL(new Request(input).url).pathname];
    const [type, body] = file ?? ['text/html; charset=utf-8', shell];
    return new Response(body, { headers: { 'content-type': type } });
  };
}

async function failing(site: HttpFetch, commit: string | null = null) {
  const checks = await runPreviewChecks({
    origin: ORIGIN,
    fetch: site,
    previewName: 'pr-7',
    commit,
  });
  return checks.filter((check) => !check.ok).map((check) => check.name);
}

test('a deployed bundle passes every check', async () => {
  expect(await failing(staticSite(GOOD), 'a'.repeat(40))).toEqual([]);
  expect(await failing(staticSite(GOOD))).toEqual([]);
});

test('a Preview serving another commit is not the one deployed', async () => {
  expect(await failing(staticSite(GOOD), 'b'.repeat(40))).toEqual([
    'deployed commit',
  ]);
});

test('a bundle built for another pull request fails', async () => {
  const other: Site = {
    ...GOOD,
    '/preview.json': [
      'application/json',
      JSON.stringify({ preview: 'pr-8', commit: 'a'.repeat(40) }),
    ],
  };
  expect(await failing(staticSite(other))).toEqual(['deployed commit']);
});

test('a missing manifest falls back to the shell and fails', async () => {
  const { '/preview.json': _, ...rest } = GOOD;
  expect(await failing(staticSite(rest))).toEqual(['deployed commit']);
});

test('a shell whose script is missing fails the bundle check', async () => {
  const { '/assets/index-abc.js': _, ...rest } = GOOD;
  expect(await failing(staticSite(rest))).toEqual(['bundle']);
  expect(await failing(staticSite(GOOD, '<div id="root"></div>'))).toEqual([
    'bundle',
  ]);
});

test('anything answering an API route means a server is present', async () => {
  const served: Site = {
    ...GOOD,
    '/api/health': ['application/json', '{"ok":true}'],
  };
  expect(await failing(staticSite(served))).toEqual(['no server']);
});

test('an unreachable Preview fails every check without throwing', async () => {
  const down: HttpFetch = async () => {
    throw new Error('getaddrinfo ENOTFOUND');
  };
  expect(await failing(down)).toEqual([
    'harness page',
    'bundle',
    'deployed commit',
    'no server',
  ]);
});

test('manifests and entry scripts are read strictly', () => {
  expect(parsePreviewManifest('{"preview":"pr-1","commit":"abc"}')).toEqual({
    preview: 'pr-1',
    commit: 'abc',
  });
  expect(parsePreviewManifest('{"preview":1}')).toBeNull();
  expect(parsePreviewManifest('<html>')).toBeNull();
  expect(entryScripts(SHELL)).toEqual(['/assets/index-abc.js']);
  expect(
    entryScripts('<script src="https://evil.example/x.js"></script>')
  ).toEqual([]);
});
