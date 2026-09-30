/**
 * The offline-shell analysis over built output: what the wall client can load
 * (static, lazy and preload edges from `index.html`, never entering the
 * harness boot) must all be in the Workbox precache. `check:offline-shell`
 * runs the same analysis against the real `dist/`.
 */
import { describe, expect, test } from 'bun:test';
import { assertProperty } from '@pkgs/property';
import fc from 'fast-check';

import {
  analyzeOfflineShell,
  keepInPrecache,
  type OfflineShellInput,
  offlineShellFailures,
  parseChunkImports,
  parseEntryHtml,
  parsePrecacheManifest,
  resolveDistPath,
  wallReachable,
} from './sw-policy';

const INDEX_HTML = `<!doctype html><html><head>
  <link rel="icon" href="/favicon.ico" />
  <script type="module" crossorigin src="/assets/index-A1.js"></script>
  <link rel="modulepreload" crossorigin href="/assets/web-B2.js">
  <link rel="stylesheet" crossorigin href="/assets/index-C3.css">
</head><body></body></html>`;

function sw(urls: readonly string[]): string {
  const entries = urls.map((url) => `{url:"${url}",revision:"r"}`).join(',');
  return `define(["./workbox-1"],function(s){s.precacheAndRoute([${entries}],{}),s.registerRoute(/x/,new s.NetworkOnly,"GET")});`;
}

/** A chunk importing `statics` and lazily `lazies`, each lazy with its CSS. */
function viteChunk(
  statics: readonly string[],
  lazies: readonly string[]
): string {
  const table = lazies.flatMap((name) => [
    `"assets/${name}.js"`,
    `"assets/${name}.css"`,
  ]);
  const head =
    lazies.length === 0
      ? ''
      : `const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=[${table.join(',')}])))=>i.map(i=>d[i]);`;
  const imports = statics
    .map((name, i) =>
      i % 2 === 0
        ? `import{t as x${String(i)}}from"./${name}.js";`
        : `import"./${name}.js";`
    )
    .join('');
  const calls = lazies
    .map(
      (name, i) =>
        `p(()=>import(\`./${name}.js\`),__vite__mapDeps([${String(2 * i)},${String(2 * i + 1)}]));`
    )
    .join('');
  return `${head}${imports}${calls}export{};`;
}

describe('parsing built output', () => {
  test('chunk imports: static, side-effect, re-export, lazy, preload', () => {
    const source = `const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/lazy-L.js","assets/dep-D.js","assets/lazy-L.css","assets/other-O.js"])))=>i.map(i=>d[i]);
import{a as b}from"./shared-S.js";import"./side-E.js";export{c}from"../assets/re-R.js";import{x}from"node:fs";
const q=()=>n(()=>import(\`./lazy-L.js\`),__vite__mapDeps([0,1,2]),import.meta.url);
const r=n(()=>import(y),__vite__mapDeps([3]));`;
    expect(parseChunkImports('assets/index-A.js', source)).toEqual({
      static: ['assets/shared-S.js', 'assets/side-E.js', 'assets/re-R.js'],
      dynamic: ['assets/lazy-L.js'],
      preload: [
        {
          target: 'assets/lazy-L.js',
          deps: ['assets/dep-D.js', 'assets/lazy-L.css'],
        },
        { target: null, deps: ['assets/other-O.js'] },
      ],
    });
  });

  test('entry html: module script, modulepreloads and stylesheets only', () => {
    expect(parseEntryHtml(INDEX_HTML)).toEqual([
      'assets/index-A1.js',
      'assets/web-B2.js',
      'assets/index-C3.css',
    ]);
  });

  test('precache manifest urls from the generated sw.js', () => {
    expect(
      parsePrecacheManifest(sw(['index.html', 'assets/index-A1.js']))
    ).toEqual(['index.html', 'assets/index-A1.js']);
    expect(parsePrecacheManifest('self.addEventListener("x",()=>{})')).toEqual(
      []
    );
  });

  test('dist paths resolve relative to the importer or the dist root', () => {
    expect(resolveDistPath('assets/a.js', './b.js')).toBe('assets/b.js');
    expect(resolveDistPath('assets/a.js', '/sql-workers/w.js')).toBe(
      'sql-workers/w.js'
    );
    expect(resolveDistPath('sql-workers/a.js', '../assets/b.js?v=1')).toBe(
      'assets/b.js'
    );
    expect(resolveDistPath('', 'assets/x.css')).toBe('assets/x.css');
  });
});

function input(
  chunks: Record<string, string>,
  precached: readonly string[]
): OfflineShellInput {
  const paths = ['index.html', 'assets/index-C3.css', ...Object.keys(chunks)];
  return {
    files: paths.map((path) => ({ path, bytes: 100 })),
    chunkSources: new Map(Object.entries(chunks)),
    indexHtml: INDEX_HTML,
    swSource: sw(precached),
    excludedRoots: ['assets/harness-boot.js'],
    extraRoots: [],
  };
}

describe('offline-shell verdict', () => {
  const chunks = {
    'assets/index-A1.js': `${viteChunk(['web-B2'], ['harness-boot', 'lazy'])}`,
    'assets/web-B2.js': viteChunk(['shared'], []),
    'assets/shared.js': '',
    'assets/lazy.js': viteChunk(['heavy'], []),
    'assets/lazy.css': '',
    'assets/heavy.js': '',
    'assets/harness-boot.js': viteChunk(['shared', 'harness-only'], []),
    'assets/harness-boot.css': '',
    'assets/harness-only.js': '',
  };
  const wallShell = [
    'index.html',
    'assets/index-A1.js',
    'assets/index-C3.css',
    'assets/web-B2.js',
    'assets/shared.js',
    'assets/lazy.js',
    'assets/lazy.css',
    'assets/heavy.js',
  ];

  test('a lazy chunk left to a runtime rule is reported', () => {
    const report = analyzeOfflineShell(
      input(
        chunks,
        wallShell.filter((path) => path !== 'assets/heavy.js')
      )
    );
    expect(report.notPrecached).toEqual(['assets/heavy.js']);
    expect(offlineShellFailures(report, 10_000)).toEqual([
      'not precached (unavailable offline): assets/heavy.js',
    ]);
  });

  test('what only the harness reaches is not required', () => {
    const report = analyzeOfflineShell(input(chunks, wallShell));
    expect(report.reachable).toEqual([...wallShell].sort());
    expect(report.notPrecached).toEqual([]);
    expect(offlineShellFailures(report, 10_000)).toEqual([]);
  });

  test('a precache over budget fails', () => {
    const report = analyzeOfflineShell(input(chunks, wallShell));
    expect(report.precachedBytes).toBe(800);
    expect(offlineShellFailures(report, 799)).toEqual([
      'precache 0.00 MiB (800 B) exceeds budget 0.00 MiB (799 B)',
    ]);
  });

  test('an entry that parses to nothing fails instead of passing vacuously', () => {
    const report = analyzeOfflineShell({
      ...input(chunks, wallShell),
      indexHtml: '<html></html>',
    });
    expect(offlineShellFailures(report, 10_000)).toContain(
      'no wall-client chunks found from index.html — parse broke?'
    );
  });

  test('a reference to a file absent from dist is reported', () => {
    const report = analyzeOfflineShell(
      input(
        { ...chunks, 'assets/web-B2.js': viteChunk(['gone'], []) },
        wallShell
      )
    );
    expect(report.dangling).toEqual(['assets/gone.js']);
  });
});

type Graph = {
  readonly statics: readonly (readonly number[])[];
  readonly lazies: readonly (readonly number[])[];
  readonly harness: number;
};

/** Random chunk graphs: chunk 0 is the entry, edges point anywhere. */
const graphArb = fc.integer({ min: 2, max: 12 }).chain((size) => {
  const edges = fc.array(
    fc.uniqueArray(fc.nat({ max: size - 1 }), { maxLength: 3 }),
    { minLength: size, maxLength: size }
  );
  return fc.record({
    statics: edges,
    lazies: edges,
    harness: fc.integer({ min: 1, max: size - 1 }),
  });
});

const chunkName = (i: number): string => `c${String(i)}`;

/**
 * Oracle: reachability over the abstract graph. A chunk's CSS rides the chunk
 * itself (Vite lists it in the preload of every lazy import of that chunk),
 * so it is required whenever the chunk is and some chunk imports it lazily.
 */
function oracle(graph: Graph): string[] {
  const seen = new Set<number>();
  const stack = [0];
  while (stack.length > 0) {
    const node = stack.pop() as number;
    if (seen.has(node) || node === graph.harness) continue;
    seen.add(node);
    stack.push(...(graph.statics[node] ?? []), ...(graph.lazies[node] ?? []));
  }
  const lazyTargets = new Set(graph.lazies.flat());
  return [...seen].flatMap((i) => [
    `assets/${chunkName(i)}.js`,
    ...(lazyTargets.has(i) ? [`assets/${chunkName(i)}.css`] : []),
  ]);
}

function graphInput(graph: Graph): Omit<OfflineShellInput, 'swSource'> {
  const chunkSources = new Map<string, string>();
  const files: { path: string; bytes: number }[] = [
    { path: 'index.html', bytes: 1 },
  ];
  graph.statics.forEach((statics, i) => {
    const source = viteChunk(
      statics.map(chunkName),
      (graph.lazies[i] ?? []).map(chunkName)
    );
    chunkSources.set(`assets/${chunkName(i)}.js`, source);
    files.push({ path: `assets/${chunkName(i)}.js`, bytes: source.length });
    files.push({ path: `assets/${chunkName(i)}.css`, bytes: 1 });
  });
  return {
    files,
    chunkSources,
    indexHtml: `<script type="module" src="/assets/${chunkName(0)}.js"></script>`,
    excludedRoots: [`assets/${chunkName(graph.harness)}.js`],
    extraRoots: [],
  };
}

describe('offline-shell properties', () => {
  test('reachability over emitted chunks matches the abstract graph', () => {
    assertProperty(
      'wall reachability = graph oracle',
      fc.property(graphArb, (graph) => {
        expect(wallReachable(graphInput(graph))).toEqual(
          ['index.html', ...oracle(graph)].sort()
        );
      })
    );
  });

  test('precaching what keepInPrecache keeps always passes the check', () => {
    assertProperty(
      'policy and check agree',
      fc.property(graphArb, (graph) => {
        const graphOnly = graphInput(graph);
        const wall = new Set(wallReachable(graphOnly));
        const precache = graphOnly.files
          .map((file) => file.path)
          .filter((path) => keepInPrecache(path, wall));
        const report = analyzeOfflineShell({
          ...graphOnly,
          swSource: sw(precache),
        });
        expect(report.notPrecached).toEqual([]);
        expect(report.dangling).toEqual([]);
      })
    );
  });

  test('dropping any wall file from the precache is reported exactly', () => {
    assertProperty(
      'every gap is caught',
      fc.property(graphArb, fc.nat(), (graph, pick) => {
        const graphOnly = graphInput(graph);
        const wall = wallReachable(graphOnly);
        const dropped = wall[pick % wall.length] as string;
        const report = analyzeOfflineShell({
          ...graphOnly,
          swSource: sw(wall.filter((path) => path !== dropped)),
        });
        expect(report.notPrecached).toEqual([dropped]);
      })
    );
  });
});
