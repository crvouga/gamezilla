/**
 * Service-worker precache policy for the super-app, and the analysis that
 * proves it (pure: text in, verdict out).
 *
 * GOAL §3: "Once the app has been opened once, it opens and works with no
 * connection." A service worker only guarantees that for files it precaches —
 * a runtime cache rule helps only a chunk that happened to be fetched while
 * online, and a lazy chunk never opened online is simply absent offline. So
 * the policy is one rule: **precache every file the wall client can load**
 * (`index.html`, its whole module graph, the URL-loaded SQL
 * workers). `build-sw.ts` applies it
 * to Workbox's manifest; `check-offline-shell.ts` re-derives it from the
 * emitted `dist/sw.js` and fails on any gap or on {@link PRECACHE_BUDGET_BYTES}.
 *
 * The module graph is read from the build output itself, the way the browser
 * sees it:
 *
 * - static edges: `import … from "./x.js"`, `import "./x.js"`, `export … from`
 * - dynamic edges: `import("./x.js")`
 * - Vite preload lists: `__vite__mapDeps([i, …])` over the chunk's
 *   `m.f=["assets/x.js", …]` table (this is where lazy CSS lives). Vite puts
 *   the imported chunk first in each list, so the rest are attributed to that
 *   chunk — they load only when it does. A list whose head is not one of the
 *   chunk's dynamic imports is attributed to the importer (conservative).
 * - the entry: `index.html` `<script src>`, `modulepreload` and stylesheet
 *   links.
 *
 * Every surface is imported eagerly, so its shared entry graph is precached.
 */

/** Public dirs the wall client loads by URL (`new Worker('/sql-workers/…')`). */
export const URL_LOADED_DIRS: readonly string[] = ['sql-workers/'];

/** Files Workbox considers for precache before the wall-reachability filter. */
export const PRECACHE_GLOB_PATTERNS: readonly string[] = [
  '**/*.{html,js,mjs,css,wasm,ttf,woff2,svg,ico,webmanifest,json}',
];

/**
 * Never precached: device-specific Apple splash PNGs (runtime image cache),
 * the dev-only raw sqlite-wasm copy (workers ship their own), source maps.
 */
export const PRECACHE_GLOB_IGNORES: readonly string[] = [
  '**/apple-splash-*.png',
  '**/generated/**',
  '**/*.map',
];

/**
 * The eager super-app graph measures about 12.4 MB raw, including a 9.94 MB
 * entry file. Allow 16 MiB for the complete graph and each individual file,
 * so Workbox never silently omits the app while installing its offline cache.
 */
export const PRECACHE_BUDGET_BYTES = 16 * 1024 * 1024;

export type DistFile = {
  readonly path: string;
  readonly bytes: number;
};

export type ChunkImports = {
  readonly static: readonly string[];
  readonly dynamic: readonly string[];
  /** Preload deps keyed by the chunk they load with (`null` = the importer). */
  readonly preload: readonly PreloadList[];
};

export type PreloadList = {
  readonly target: string | null;
  readonly deps: readonly string[];
};

export type OfflineShellInput = {
  readonly files: readonly DistFile[];
  /** Source text of every `.js` chunk, keyed by dist-relative path. */
  readonly chunkSources: ReadonlyMap<string, string>;
  readonly indexHtml: string;
  readonly swSource: string;
  /** Chunks whose subgraph is not part of the wall client (dev surfaces). */
  readonly excludedRoots: readonly string[];
  /** Files the wall client loads by URL rather than by import (workers). */
  readonly extraRoots: readonly string[];
};

export type OfflineShellReport = {
  /** Files the wall client can load (entry, JS, CSS, extra roots), sorted. */
  readonly reachable: readonly string[];
  /** Reachable files missing from the precache manifest, sorted. */
  readonly notPrecached: readonly string[];
  /** Referenced files that do not exist in `dist/`, sorted. */
  readonly dangling: readonly string[];
  readonly precachedBytes: number;
  readonly precachedCount: number;
};

export const ENTRY_HTML = 'index.html';

const SHELL_FILE = /\.(?:m?js|css)$/;
const STATIC_IMPORT =
  /(?:\bfrom|\bimport)\s*(["'`])((?:\.{1,2}\/|\/)[^"'`\s]+)\1/g;
const DYNAMIC_IMPORT =
  /\bimport\(\s*(["'`])((?:\.{1,2}\/|\/)[^"'`\s]+)\1\s*\)/g;
const PRELOAD_TABLE = /m\.f\|\|\(m\.f=\[([^\]]*)\]/;
const PRELOAD_CALL = /__vite__mapDeps\(\[([\d,\s]*)\]/g;
const QUOTED = /(["'`])([^"'`]+)\1/g;
const PRECACHE_URL = /["']?url["']?\s*:\s*(["'])([^"']+)\1/g;
const HTML_TAG = /<(?:script|link)\b[^>]*>/g;
const HTML_ATTR = /\b(src|href|rel)\s*=\s*(["'])([^"']*)\2/g;
const HTML_LOADS = new Set(['modulepreload', 'stylesheet']);

export function isShellFile(path: string): boolean {
  return SHELL_FILE.test(path);
}

/** Resolves `spec` against the dist-relative file `from` (`/x` = dist root). */
export function resolveDistPath(from: string, spec: string): string {
  const withoutQuery = spec.replace(/[?#].*$/, '');
  const parts = withoutQuery.startsWith('/')
    ? []
    : from.split('/').slice(0, -1);
  for (const segment of withoutQuery.split('/')) {
    if (segment === '' || segment === '.') continue;
    if (segment === '..') parts.pop();
    else parts.push(segment);
  }
  return parts.join('/');
}

function captures(source: string, pattern: RegExp, group: number): string[] {
  return [...source.matchAll(pattern)].map((match) => match[group] ?? '');
}

function preloadLists(
  source: string,
  dynamic: readonly string[]
): PreloadList[] {
  const table = PRELOAD_TABLE.exec(source);
  if (table === null) return [];
  const entries = captures(table[1] ?? '', QUOTED, 2).map((path) =>
    resolveDistPath('', path)
  );
  const dynamicTargets = new Set(dynamic);
  return captures(source, PRELOAD_CALL, 1).map((indices) => {
    const deps = indices
      .split(',')
      .filter((index) => index.trim() !== '')
      .map((index) => entries[Number(index)])
      .filter((path): path is string => path !== undefined);
    const head = deps[0];
    const target = head !== undefined && dynamicTargets.has(head) ? head : null;
    return { target, deps: target === null ? deps : deps.slice(1) };
  });
}

/** Import edges of one built chunk, as dist-relative paths. */
export function parseChunkImports(
  chunkPath: string,
  source: string
): ChunkImports {
  const resolve = (spec: string): string => resolveDistPath(chunkPath, spec);
  const dynamic = captures(source, DYNAMIC_IMPORT, 2).map(resolve);
  const staticImports = captures(source, STATIC_IMPORT, 2).map(resolve);
  return {
    static: staticImports.filter(isShellFile),
    dynamic: dynamic.filter(isShellFile),
    preload: preloadLists(source, dynamic),
  };
}

/** Files `index.html` loads at boot: module scripts, modulepreloads, CSS. */
export function parseEntryHtml(html: string): string[] {
  const out: string[] = [];
  for (const [tag] of html.matchAll(HTML_TAG)) {
    const attrs = new Map(
      [...tag.matchAll(HTML_ATTR)].map((m) => [m[1] ?? '', m[3] ?? ''])
    );
    const isScript = tag.startsWith('<script');
    const url = isScript ? attrs.get('src') : attrs.get('href');
    const loads = isScript || HTML_LOADS.has(attrs.get('rel') ?? '');
    if (url !== undefined && loads) out.push(resolveDistPath('', url));
  }
  return out;
}

/** Dist-relative URLs in the Workbox `precacheAndRoute([...])` manifest. */
export function parsePrecacheManifest(swSource: string): string[] {
  const start = swSource.indexOf('precacheAndRoute(');
  if (start === -1) return [];
  return captures(swSource.slice(start), PRECACHE_URL, 2).map((url) =>
    resolveDistPath('', url)
  );
}

function edgesOf(sources: ReadonlyMap<string, string>): Map<string, string[]> {
  const edges = new Map<string, string[]>();
  const add = (from: string, to: readonly string[]): void => {
    edges.set(from, [...(edges.get(from) ?? []), ...to]);
  };
  for (const [path, source] of sources) {
    const imports = parseChunkImports(path, source);
    add(path, [...imports.static, ...imports.dynamic]);
    for (const list of imports.preload) add(list.target ?? path, list.deps);
  }
  return edges;
}

/** Every node reachable from `roots` without entering `excluded`. */
export function reachableFrom(args: {
  readonly edges: ReadonlyMap<string, readonly string[]>;
  readonly roots: readonly string[];
  readonly excluded: ReadonlySet<string>;
}): Set<string> {
  const seen = new Set<string>();
  const stack = args.roots.filter((root) => !args.excluded.has(root));
  while (stack.length > 0) {
    const node = stack.pop() as string;
    if (seen.has(node)) continue;
    seen.add(node);
    for (const next of args.edges.get(node) ?? []) {
      if (!seen.has(next) && !args.excluded.has(next)) stack.push(next);
    }
  }
  return seen;
}

function sorted(values: Iterable<string>): string[] {
  return [...values].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/** Files the wall client can load: `index.html`, its graph, extra roots. */
export function wallReachable(
  input: Omit<OfflineShellInput, 'swSource' | 'files'>
): string[] {
  const roots = [
    ENTRY_HTML,
    ...parseEntryHtml(input.indexHtml),
    ...input.extraRoots,
  ];
  return sorted(
    reachableFrom({
      edges: edgesOf(input.chunkSources),
      roots,
      excluded: new Set(input.excludedRoots),
    })
  );
}

export function analyzeOfflineShell(
  input: OfflineShellInput
): OfflineShellReport {
  const sizes = new Map(input.files.map((file) => [file.path, file.bytes]));
  const precached = new Set(parsePrecacheManifest(input.swSource));
  const reachable = wallReachable(input);
  let precachedBytes = 0;
  for (const url of precached) precachedBytes += sizes.get(url) ?? 0;
  return {
    reachable,
    notPrecached: reachable.filter(
      (path) => sizes.has(path) && !precached.has(path)
    ),
    dangling: reachable.filter((path) => !sizes.has(path)),
    precachedBytes,
    precachedCount: precached.size,
  };
}

/**
 * Workbox `manifestTransforms` filter: a JS/CSS file stays in the precache
 * only when the wall client can load it; every other globbed file (icons,
 * fonts, manifest) stays.
 */
export function keepInPrecache(
  url: string,
  wallFiles: ReadonlySet<string>
): boolean {
  return !isShellFile(url) || wallFiles.has(resolveDistPath('', url));
}

function formatBytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(2)} MiB (${String(bytes)} B)`;
}

/** Every reason the build breaks the offline-shell policy (empty = pass). */
export function offlineShellFailures(
  report: OfflineShellReport,
  budgetBytes: number
): string[] {
  const failures: string[] = [];
  if (report.reachable.length <= 1) {
    failures.push('no wall-client chunks found from index.html — parse broke?');
  }
  for (const path of report.notPrecached) {
    failures.push(`not precached (unavailable offline): ${path}`);
  }
  for (const path of report.dangling) {
    failures.push(`referenced but missing from dist/: ${path}`);
  }
  if (report.precachedBytes > budgetBytes) {
    failures.push(
      `precache ${formatBytes(report.precachedBytes)} exceeds budget ${formatBytes(budgetBytes)}`
    );
  }
  return failures;
}

export function formatOfflineShellSummary(
  report: OfflineShellReport,
  budgetBytes: number
): string {
  return [
    `wall-client files: ${String(report.reachable.length)}`,
    `precached: ${String(report.precachedCount)} entries, ${formatBytes(report.precachedBytes)}`,
    `budget: ${formatBytes(budgetBytes)}`,
  ].join('\n');
}
