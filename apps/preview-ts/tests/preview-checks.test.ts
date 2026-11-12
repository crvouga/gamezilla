import { expect, test } from 'bun:test';
import type { HttpFetch } from '@pkgs/http-client-shared-ts/types';
import {
  entryScripts,
  parsePreviewManifest,
  runPreviewChecks,
  runStorybookChecks,
  storyCount,
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

/** Static hosting as an assets-only Preview does it: no fallback, a 404. */
function staticSite(files: Site, shell: string | null = SHELL): HttpFetch {
  return async (input) => {
    const path = new URL(new Request(input).url).pathname;
    const file =
      files[path] ??
      (path === '/' && shell !== null
        ? (['text/html; charset=utf-8', shell] as const)
        : undefined);
    if (file === undefined)
      return new Response('Not found', {
        status: 404,
        headers: { 'content-type': 'text/html' },
      });
    return new Response(file[1], { headers: { 'content-type': file[0] } });
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

test('a missing manifest fails', async () => {
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

test('a Preview that does not serve the harness page fails', async () => {
  expect(await failing(staticSite(GOOD, null))).toEqual([
    'harness page',
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

const STORYBOOK: Site = {
  '/iframe.html': ['text/html', '<div id="storybook-root"></div>'],
  '/index.json': [
    'application/json',
    JSON.stringify({ v: 5, entries: { 'button--primary': {} } }),
  ],
  '/preview.json': [
    'application/json',
    JSON.stringify({ preview: 'pr-7', commit: 'a'.repeat(40) }),
  ],
};

async function failingStorybook(site: HttpFetch) {
  const checks = await runStorybookChecks({
    origin: 'https://pr-7.storybook-preview.acme.example',
    fetch: site,
    previewName: 'pr-7',
    commit: 'a'.repeat(40),
  });
  return checks.filter((check) => !check.ok).map((check) => check.name);
}

test('a deployed Storybook passes every check', async () => {
  expect(await failingStorybook(staticSite(STORYBOOK))).toEqual([]);
});

test('a Storybook with no stories, no frame or another commit fails', async () => {
  const empty: Site = {
    ...STORYBOOK,
    '/index.json': ['application/json', '{"v":5,"entries":{}}'],
  };
  expect(await failingStorybook(staticSite(empty))).toEqual(['story index']);
  const { '/iframe.html': _, ...frameless } = STORYBOOK;
  expect(await failingStorybook(staticSite(frameless))).toEqual([
    'story frame',
  ]);
  const stale: Site = {
    ...STORYBOOK,
    '/preview.json': [
      'application/json',
      JSON.stringify({ preview: 'pr-7', commit: 'b'.repeat(40) }),
    ],
  };
  expect(await failingStorybook(staticSite(stale))).toEqual([
    'deployed commit',
  ]);
});

test('a story index is counted strictly', () => {
  expect(storyCount('{"entries":{"a":{},"b":{}}}')).toBe(2);
  expect(storyCount('{"entries":null}')).toBe(0);
  expect(storyCount('<html>')).toBe(0);
});
