import { describe, expect, test } from 'bun:test';
import { sumPrecacheFromSw } from './bundle-budget';
import {
  collectLazyRoots,
  lazyGraphJsFiles,
  lazyOverrideKey,
} from './bundle-budget-lazy';
import type { Manifest } from './bundle-budget-manifest';
import { assertFirstLoadApiBytes } from './check-first-load-api-budget';
import { collectExternalScriptSrcs } from './check-index-html-scripts';
import {
  collectDynamicImports,
  collectStaticSpecifiers,
} from './client-critical-path-imports';
import {
  assertRouteMetrics,
  findBannedFetches,
  median,
  mediansFromLhrs,
} from './lighthouse-report';

const MANIFEST: Manifest = {
  'src/main.tsx': {
    file: 'assets/index-aaa.js',
    isEntry: true,
    imports: ['chunk-bbb'],
    dynamicImports: ['src/lazy.tsx'],
    css: ['assets/index-aaa.css'],
  },
  'chunk-bbb': {
    file: 'assets/chunk-bbb.js',
    imports: [],
  },
  'src/lazy.tsx': {
    file: 'assets/lazy-ccc.js',
    isEntry: false,
    imports: ['lazy-dep'],
  },
  'lazy-dep': {
    file: 'assets/lazy-dep.js',
    imports: [],
  },
};

describe('bundle-budget lazy collectors', () => {
  test('collectLazyRoots finds dynamicImports off the initial graph', () => {
    expect(collectLazyRoots(MANIFEST)).toEqual(['src/lazy.tsx']);
  });

  test('lazyGraphJsFiles excludes initial chunks', () => {
    const initial = new Set(['src/main.tsx', 'chunk-bbb']);
    expect(lazyGraphJsFiles(MANIFEST, 'src/lazy.tsx', initial).sort()).toEqual(
      ['assets/lazy-ccc.js', 'assets/lazy-dep.js'].sort()
    );
  });

  test('lazyOverrideKey matches longest override substring', () => {
    expect(
      lazyOverrideKey('libs/chess/src/root/client/board', {
        chess: 350,
        'game-plugins': 400,
      })
    ).toBe('chess');
  });

  test('sumPrecacheFromSw sums workbox manifest sizes', () => {
    const sw = `self.__WB_MANIFEST;precacheAndRoute([{"url":"a.js","revision":null,"size":1000},{"url":"b.wasm","revision":"x","size":2000}]);`;
    expect(sumPrecacheFromSw(sw)).toBe(3000);
  });
});

describe('lighthouse-report', () => {
  test('median picks middle value', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
  });

  test('mediansFromLhrs + assertRouteMetrics flags overs', () => {
    const lhr = {
      audits: {
        'largest-contentful-paint': { numericValue: 5000 },
        'total-blocking-time': { numericValue: 100 },
        interactive: { numericValue: 1000 },
        'speed-index': { numericValue: 1000 },
        'total-byte-weight': { numericValue: 50_000 },
        'cumulative-layout-shift': { numericValue: 0.01 },
      },
    };
    const medians = mediansFromLhrs([lhr, lhr, lhr]);
    const overs = assertRouteMetrics({
      routeId: 'shell',
      path: '/',
      medians,
      budget: {
        lcpMs: 4000,
        tbtMs: 600,
        ttiMs: 5000,
        speedIndexMs: 4500,
        totalByteWeightKb: 300,
        cls: 0.1,
      },
    });
    expect(overs.some((m) => m.includes('LCP'))).toBe(true);
  });

  test('findBannedFetches matches patterns', () => {
    const hits = findBannedFetches({
      lhr: {
        audits: {
          'network-requests': {
            details: {
              items: [
                { url: 'https://x/assets/game-plugins-abc.js' },
                { url: 'https://x/assets/ok.js' },
              ],
            },
          },
        },
      },
      patterns: ['game-plugins', '.wasm'],
    });
    expect(hits).toEqual(['https://x/assets/game-plugins-abc.js']);
  });
});

describe('critical-path dynamic imports', () => {
  test('collectStaticSpecifiers still skips nested import()', () => {
    const specs = collectStaticSpecifiers(`
      import { bar } from './bar';
      const x = import('./lazy');
    `);
    expect(specs).toEqual(['./bar']);
  });

  test('collectDynamicImports flags top-level and nested denylist', () => {
    const hits = collectDynamicImports(`
import './side';
void import('./top');
export function load() {
  return import('@libs/games/game-plugins.client');
}
const deferred = () => import('./lazy');
type X = typeof import('./types');
function f(): import('./types').Foo { return null as never; }
`);
    expect(hits.some((h) => h.specifier === './top' && h.topLevel)).toBe(true);
    expect(
      hits.some(
        (h) => h.specifier === '@libs/games/game-plugins.client' && !h.topLevel
      )
    ).toBe(true);
    expect(hits.some((h) => h.specifier === './lazy' && !h.topLevel)).toBe(
      true
    );
    expect(hits.some((h) => h.specifier === './types')).toBe(false);
  });
});
describe('index-html scripts + first-load api', () => {
  test('collectExternalScriptSrcs ignores module entry', () => {
    const html = `<script type="module" src="/src/main.tsx"></script>
<script src="https://evil.example/x.js"></script>`;
    expect(collectExternalScriptSrcs(html)).toEqual([
      'https://evil.example/x.js',
    ]);
  });

  test('assertFirstLoadApiBytes warn does not hard-fail', () => {
    const failed = assertFirstLoadApiBytes({
      totalBytes: 200_000,
      budgetKb: 50,
      mode: 'warn',
    });
    expect(failed).toBe(false);
  });
});
