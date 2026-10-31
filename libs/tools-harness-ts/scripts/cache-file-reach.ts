// @io-wall-ok — reads the import graph between source files (`verify-cache-hygiene.ts`).
/**
 * How far an edit to one file travels, file by file.
 *
 * Turborepo hashes a package as a whole, so an edit to any file in it reruns
 * everything that depends on the package. The import graph says how much of
 * that is necessary: if no other package imports a file, directly or through
 * files that others import, the file did not need to share a hash with the
 * rest. Many such files in a package with many dependents are the signature
 * of a hub that bundles unrelated things, and the list of them is the split.
 *
 * This is an estimate from `import`/`export … from`/`require`/`import()`
 * specifiers: a package consumed some other way (a `--preload`, a config
 * file) looks smaller than it is, which is why `cache-hygiene.json` lets a
 * package be grandfathered with a reason.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { dirname, join as joinPosix, normalize } from 'node:path/posix';

const GRAPH_FILE = /\.(?:[cm]?[jt]sx?|css|svg|png|jpe?g|webp|woff2?|ttf)$/;
const TEXT_FILE = /\.(?:[cm]?[jt]sx?|css)$/;
const CSS_URL = /url\(\s*['"]?([^'"\s)]+)['"]?\s*\)/g;
const TEST_FILE = /\.test\.[cm]?[jt]sx?$/;
const SPECIFIER =
  /(?:from\s*|import\s*\(\s*|require\(\s*|import\s+|new\s+URL\s*\(\s*|@import\s+)['"]([^'"]+)['"]/g;
const WORKSPACE_SPECIFIER = /^@(apps|libs|pkgs)\/([^/]+)\/(.+)$/;
const TIERS = ['apps', 'libs', 'pkgs'] as const;

export type FileReach = {
  readonly file: string;
  /** Packages that rerun when this file changes, its own included. */
  readonly packages: number;
};

const SKIPPED_DIRECTORIES = new Set([
  'node_modules',
  '.cache',
  'dist',
  '.git',
  '.turbo',
  '.build',
  'baselines',
]);

function sourceFiles(root: string): Set<string> {
  const files = new Set<string>();
  const stack = TIERS.map((tier) => tier as string);
  for (let dir = stack.pop(); dir !== undefined; dir = stack.pop())
    for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!SKIPPED_DIRECTORIES.has(entry.name))
          stack.push(`${dir}/${entry.name}`);
      } else if (entry.isFile() && GRAPH_FILE.test(entry.name))
        files.add(`${dir}/${entry.name}`);
    }
  return files;
}

function resolveSpecifier(
  from: string,
  specifier: string,
  resolveBase: (base: string) => string | undefined
): string | undefined {
  if (specifier.startsWith('.'))
    return resolveBase(normalize(joinPosix(dirname(from), specifier)));
  const match = WORKSPACE_SPECIFIER.exec(specifier);
  if (match === null) return undefined;
  const dir = `${match[1]}/${match[2]}`;
  return (
    resolveBase(`${dir}/src/${match[3]}`) ??
    resolveBase(`${dir}/scripts/${match[3]}`)
  );
}

export type ImportGraph = {
  /** `importersOf.get(file)`: the files that import `file`. */
  readonly importersOf: ReadonlyMap<string, ReadonlySet<string>>;
};

/** Resolve each module once per scan, including missing modules. */
function moduleResolver(files: ReadonlySet<string>) {
  const cache = new Map<string, string | undefined>();
  const suffixes = [
    '',
    '.ts',
    '.tsx',
    '.d.ts',
    '.mts',
    '.js',
    '.cjs',
    '/index.ts',
    '/index.tsx',
  ];
  return (base: string): string | undefined => {
    if (cache.has(base)) return cache.get(base);
    let resolved: string | undefined;
    for (const suffix of suffixes)
      if (files.has(base + suffix)) {
        resolved = base + suffix;
        break;
      }
    cache.set(base, resolved);
    return resolved;
  };
}

/** Import relationships from a complete source snapshot; no cross-scan cache. */
export function buildImportGraph(
  files: ReadonlySet<string>,
  read: (file: string) => string
): ImportGraph {
  const resolveBase = moduleResolver(files);
  const importersOf = new Map<string, Set<string>>();
  for (const file of files) {
    if (!TEXT_FILE.test(file)) continue;
    const content = read(file);
    const specifiers = [
      ...content.matchAll(SPECIFIER),
      ...(file.endsWith('.css') ? content.matchAll(CSS_URL) : []),
    ];
    for (const [, specifier] of specifiers) {
      const target = resolveSpecifier(file, specifier!, resolveBase);
      if (target === undefined || target === file) continue;
      const importers = importersOf.get(target) ?? new Set<string>();
      importers.add(file);
      importersOf.set(target, importers);
    }
  }
  return { importersOf };
}

export function readImportGraph(root: string): ImportGraph {
  return buildImportGraph(sourceFiles(root), (file) =>
    readFileSync(join(root, file), 'utf8')
  );
}

function packageOf(file: string): string {
  return file.split('/').slice(0, 2).join('/');
}

/** Exact reach, or `maxPackages + 1` once a classification threshold is exceeded. */
export function fileReach(
  graph: ImportGraph,
  file: string,
  maxPackages = Number.POSITIVE_INFINITY
): FileReach {
  const reached = new Set([file]);
  const packages = new Set([packageOf(file)]);
  const queue = [file];
  for (let next = queue.pop(); next !== undefined; next = queue.pop())
    for (const importer of graph.importersOf.get(next) ?? [])
      if (!reached.has(importer)) {
        reached.add(importer);
        packages.add(packageOf(importer));
        if (packages.size > maxPackages)
          return { file, packages: packages.size };
        // A test file is a leaf: nothing imports it.
        if (!TEST_FILE.test(importer)) queue.push(importer);
      }
  return { file, packages: packages.size };
}
