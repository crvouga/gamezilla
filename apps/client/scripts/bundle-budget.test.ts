import { describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  assertNoDeferredOnInitial,
  collectFontFilesFromCss,
  collectInitialCssFiles,
  collectInitialJsFiles,
  findEntryHtmlPreloadHits,
  type Manifest,
  pathMatchesDeferred,
} from './bundle-budget';

const MANIFEST: Manifest = {
  'src/main.tsx': {
    file: 'assets/index-aaa.js',
    isEntry: true,
    imports: ['chunk-bbb'],
    css: ['assets/index-aaa.css'],
  },
  'chunk-bbb': {
    file: 'assets/chunk-bbb.js',
    imports: [],
  },
  'src/lazy.tsx': {
    file: 'assets/lazy-ccc.js',
    isEntry: false,
    imports: [],
  },
};

describe('bundle-budget collectors', () => {
  test('collectInitialJsFiles follows static imports only', () => {
    expect(collectInitialJsFiles(MANIFEST).sort()).toEqual(
      ['assets/chunk-bbb.js', 'assets/index-aaa.js'].sort()
    );
  });

  test('collectInitialCssFiles reads entry css links', () => {
    expect(collectInitialCssFiles(MANIFEST)).toEqual(['assets/index-aaa.css']);
  });

  test('pathMatchesDeferred catches wasm / sql-workers', () => {
    expect(pathMatchesDeferred('sql-workers/sqlite3.wasm', ['.wasm'])).toBe(
      true
    );
    expect(
      pathMatchesDeferred('assets/index.js', ['sql-workers', '.wasm'])
    ).toBe(false);
  });

  test('assertNoDeferredOnInitial lists offending files', () => {
    expect(
      assertNoDeferredOnInitial({
        files: ['assets/a.js', 'sql-workers/sqlite3.wasm'],
        patterns: ['sql-workers', '.wasm'],
      })
    ).toEqual(['sql-workers/sqlite3.wasm']);
  });

  test('findEntryHtmlPreloadHits finds deferred hrefs', () => {
    const html = `<!doctype html><link rel="preload" href="/sql-workers/sqlite3.wasm" as="fetch">`;
    expect(
      findEntryHtmlPreloadHits({
        html,
        patterns: ['sql-workers', '.wasm'],
      })
    ).toEqual(['/sql-workers/sqlite3.wasm']);
  });

  test('collectFontFilesFromCss resolves relative url() fonts', () => {
    const dist = mkdtempSync(join(tmpdir(), 'budget-fonts-'));
    mkdirSync(join(dist, 'assets'), { recursive: true });
    writeFileSync(
      join(dist, 'assets/app.css'),
      `@font-face{src:url(./font.woff2) format("woff2")}`
    );
    writeFileSync(join(dist, 'assets/font.woff2'), 'font');
    expect(
      collectFontFilesFromCss({
        distDir: dist,
        cssRelPaths: ['assets/app.css'],
      })
    ).toEqual(['assets/font.woff2']);
  });
});
