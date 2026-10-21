import { expect, test } from 'bun:test';
import type { PreloadChunk } from '@pkgs/vite-workspace-resolver-server-ts/preload-dynamic-entry';
import { dynamicEntryPreloadTags } from '@pkgs/vite-workspace-resolver-server-ts/preload-dynamic-entry';

function chunk(
  fileName: string,
  overrides: Partial<PreloadChunk> = {}
): PreloadChunk {
  return {
    type: 'chunk',
    fileName,
    facadeModuleId: null,
    isEntry: false,
    isDynamicEntry: false,
    imports: [],
    ...overrides,
  };
}

const bundle = {
  'assets/index.js': chunk('assets/index.js', {
    facadeModuleId: '/repo/apps/client-ts/index.html',
    isEntry: true,
    imports: ['assets/runtime.js'],
  }),
  'assets/main.js': chunk('assets/main.js', {
    facadeModuleId: '/repo/apps/client-ts/src/main.tsx',
    isDynamicEntry: true,
    imports: ['assets/index.js', 'assets/runtime.js'],
    viteMetadata: { importedCss: new Set(['assets/main.css']) },
  }),
  'assets/runtime.js': chunk('assets/runtime.js'),
  'assets/other.js': chunk('assets/other.js', {
    facadeModuleId: '/repo/libs/x/src/screen.tsx',
    isDynamicEntry: true,
  }),
  'assets/main.css': { type: 'asset' as const },
};

function hrefs(rel: string): unknown[] {
  return dynamicEntryPreloadTags({ bundle, entry: '/src/main.tsx', base: '/' })
    .filter((tag) => tag.attrs?.['rel'] === rel)
    .map((tag) => tag.attrs?.['href']);
}

test('preloads the dynamic entry with everything it statically imports', () => {
  expect(hrefs('modulepreload').sort()).toEqual([
    '/assets/main.js',
    '/assets/runtime.js',
  ]);
  expect(hrefs('preload')).toEqual(['/assets/main.css']);
});

test('leaves other dynamic entries to load when they are imported', () => {
  expect(hrefs('modulepreload')).not.toContain('/assets/other.js');
});

test('adds nothing when the build has no such dynamic entry', () => {
  expect(
    dynamicEntryPreloadTags({ bundle, entry: '/src/absent.tsx', base: '/' })
  ).toEqual([]);
});
