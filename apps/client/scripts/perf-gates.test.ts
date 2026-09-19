import { describe, expect, test } from 'bun:test';
import {
  collectLazyRoots,
  lazyGraphJsFiles,
  lazyOverrideKey,
} from './bundle-budget-lazy';
import type { Manifest } from './bundle-budget-manifest';
import { collectExternalScriptSrcs } from './check-index-html-scripts';
import {
  collectDynamicImports,
  collectStaticSpecifiers,
} from './client-critical-path-imports';

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
});

describe('critical-path dynamic imports', () => {
  test('collectStaticSpecifiers still skips nested import()', () => {
    const specs = collectStaticSpecifiers(`
      import { bar } from './bar';
      const x = import('./lazy');
    `);
    expect(specs).toEqual(['./bar']);
  });

  test('collectDynamicImports marks top-level vs nested import()', () => {
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

describe('index-html scripts', () => {
  test('collectExternalScriptSrcs ignores module entry', () => {
    const html = `<script type="module" src="/src/main.tsx"></script>
<script src="https://evil.example/x.js"></script>`;
    expect(collectExternalScriptSrcs(html)).toEqual([
      'https://evil.example/x.js',
    ]);
  });
});
