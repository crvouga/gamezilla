import { describe, expect, test } from 'bun:test';
import {
  collectDynamicImports,
  collectStaticSpecifiers,
} from './client-critical-path-imports';
import {
  bannedIndexHtmlScripts,
  collectExternalScriptSrcs,
} from './verify-index-html-scripts';

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

test('index.html loads no third-party script outside the allowlist', () => {
  expect(bannedIndexHtmlScripts()).toEqual([]);
});
