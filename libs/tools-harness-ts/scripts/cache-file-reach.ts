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
import { dirname, join, normalize } from 'node:path';

const SOURCE = /\.(?:[cm]?[jt]sx?)$/;
const TEST_FILE = /\.test\.[cm]?[jt]sx?$/;
const SPECIFIER =
  /(?:from\s*|import\s*\(\s*|require\(\s*|import\s+)['"]([^'"]+)['"]/g;
const WORKSPACE_SPECIFIER = /^@(apps|libs|pkgs)\/([^/]+)\/(.+)$/;
const TIERS = ['apps', 'libs', 'pkgs'] as const;

export type FileReach = {
  readonly file: string;
  /** Packages that rerun when this file changes, its own included. */
  readonly packages: number;
};

const SKIPPED_DIRECTORIES = new Set(['node_modules', '.cache', 'dist']);

function sourceFiles(root: string): Set<string> {
  const files = new Set<string>();
  const stack = TIERS.map((tier) => tier as string);
  for (let dir = stack.pop(); dir !== undefined; dir = stack.pop())
    for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!SKIPPED_DIRECTORIES.has(entry.name))
          stack.push(`${dir}/${entry.name}`);
      } else if (entry.isFile() && SOURCE.test(entry.name))
        files.add(`${dir}/${entry.name}`);
    }
  return files;
}

function resolveSpecifier(
  from: string,
  specifier: string,
  files: ReadonlySet<string>
): string | undefined {
  const candidates = (base: string): string[] => [
    base,
    ...['.ts', '.tsx', '.d.ts', '.mts', '.js', '.cjs'].map((e) => base + e),
    `${base}/index.ts`,
    `${base}/index.tsx`,
  ];
  if (specifier.startsWith('.'))
    return candidates(normalize(join(dirname(from), specifier))).find((c) =>
      files.has(c)
    );
  const match = WORKSPACE_SPECIFIER.exec(specifier);
  if (match === null) return undefined;
  const dir = `${match[1]}/${match[2]}`;
  return ['src', 'scripts']
    .flatMap((visible) => candidates(`${dir}/${visible}/${match[3]}`))
    .find((c) => files.has(c));
}

export type ImportGraph = {
  /** `importersOf.get(file)`: the files that import `file`. */
  readonly importersOf: ReadonlyMap<string, ReadonlySet<string>>;
};

export function readImportGraph(root: string): ImportGraph {
  const files = sourceFiles(root);
  const importersOf = new Map<string, Set<string>>();
  for (const file of files)
    for (const [, specifier] of readFileSync(join(root, file), 'utf8').matchAll(
      SPECIFIER
    )) {
      const target = resolveSpecifier(file, specifier!, files);
      if (target === undefined || target === file) continue;
      const importers = importersOf.get(target) ?? new Set<string>();
      importers.add(file);
      importersOf.set(target, importers);
    }
  return { importersOf };
}

function packageOf(file: string): string {
  return file.split('/').slice(0, 2).join('/');
}

/** Packages that rerun when `file` changes, found through its importers. */
export function fileReach(graph: ImportGraph, file: string): FileReach {
  const reached = new Set([file]);
  const queue = [file];
  for (let next = queue.pop(); next !== undefined; next = queue.pop())
    for (const importer of graph.importersOf.get(next) ?? [])
      if (!reached.has(importer)) {
        reached.add(importer);
        // A test file is a leaf: nothing imports it.
        if (!TEST_FILE.test(importer)) queue.push(importer);
      }
  return { file, packages: new Set([...reached].map(packageOf)).size };
}
