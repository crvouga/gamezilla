// @io-wall-ok — reads the workspace graph (`verify-cache-hygiene.ts`).
/**
 * The task graph Turborepo draws, as far as cache invalidation goes.
 *
 * `lint`, `tc` and `test` of a package depend on `^src`: the `src` hash of
 * every package it declares. A package's `src` depends on the `src` of the
 * packages its `turbo.json` lists (`src-task-edges.ts`), or of every declared
 * one when it lists none. So an edit to a file a dependent can see reruns:
 *
 * - the package itself,
 * - every package whose `src` inherits its `src`, transitively, and
 * - every package that declares one of those, for its own three tasks.
 *
 * That count is the package's blast radius. It is what a cache-friendly
 * structure keeps small, and the one number every rule in
 * `cache-hygiene.ts` is a way of controlling.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { productionFilesUnder } from './src-task-edges';

export type GraphPackage = {
  readonly name: string;
  /** Repo-relative directory: `pkgs/clock-shared-ts`. */
  readonly dir: string;
  /** Workspace packages `package.json` declares, in any section. */
  readonly declared: ReadonlySet<string>;
  /** Workspace packages its `src` hash inherits. */
  readonly srcEdges: ReadonlySet<string>;
  /** Repo-relative non-test files under `src/`. */
  readonly srcFiles: readonly string[];
};

export type Blast = {
  /** Packages whose `lint`, `tc` and `test` rerun, the package included. */
  readonly packages: ReadonlySet<string>;
  /** Packages whose `src` hash changes, the package included. */
  readonly srcHashes: ReadonlySet<string>;
};

export type Reverse = ReadonlyMap<string, ReadonlySet<string>>;

function reverse(
  packages: readonly GraphPackage[],
  edges: (pkg: GraphPackage) => ReadonlySet<string>
): Map<string, Set<string>> {
  const result = new Map<string, Set<string>>();
  for (const pkg of packages)
    for (const dependency of edges(pkg)) {
      const dependents = result.get(dependency) ?? new Set<string>();
      dependents.add(pkg.name);
      result.set(dependency, dependents);
    }
  return result;
}

export function blastRadii(
  packages: readonly GraphPackage[]
): Map<string, Blast> {
  const declaredBy = reverse(packages, (pkg) => pkg.declared);
  const srcBy = reverse(packages, (pkg) => pkg.srcEdges);
  const result = new Map<string, Blast>();
  for (const { name } of packages) {
    const srcHashes = new Set([name]);
    for (const next of srcHashes)
      for (const dependent of srcBy.get(next) ?? []) srcHashes.add(dependent);
    const rerun = new Set(srcHashes);
    for (const hashed of srcHashes)
      for (const dependent of declaredBy.get(hashed) ?? [])
        rerun.add(dependent);
    result.set(name, { packages: rerun, srcHashes });
  }
  return result;
}

/** Direct dependents of `name` through `src` edges, with the blast each adds. */
export function srcDependents(
  packages: readonly GraphPackage[],
  name: string
): string[] {
  return packages
    .filter((pkg) => pkg.srcEdges.has(name))
    .map((pkg) => pkg.name)
    .sort();
}

const TIERS = ['apps', 'libs', 'pkgs'] as const;

/** `file` relative to `root`, with `/` separators on every platform. */
export function toRepoPath(root: string, file: string): string {
  return file.slice(root.length + 1).replaceAll('\\', '/');
}

type Manifest = {
  name: string;
  [section: string]: unknown;
};

function declaredDependencies(manifest: Manifest): string[] {
  return [
    'dependencies',
    'devDependencies',
    'optionalDependencies',
    'peerDependencies',
  ].flatMap((section) =>
    Object.keys((manifest[section] as object | undefined) ?? {})
  );
}

function listedSrcEdges(root: string, dir: string): string[] | undefined {
  const file = join(root, dir, 'turbo.json');
  if (!existsSync(file)) return undefined;
  const listed = (
    JSON.parse(readFileSync(file, 'utf8')) as {
      tasks?: { src?: { dependsOn?: string[] } };
    }
  ).tasks?.src?.dependsOn;
  return listed?.map((edge) => edge.replace(/#src$/, ''));
}

export function readGraph(root: string): GraphPackage[] {
  const manifests: { dir: string; manifest: Manifest }[] = [];
  for (const tier of TIERS)
    for (const entry of readdirSync(join(root, tier)).sort()) {
      const file = join(root, tier, entry, 'package.json');
      if (existsSync(file))
        manifests.push({
          dir: `${tier}/${entry}`,
          manifest: JSON.parse(readFileSync(file, 'utf8')) as Manifest,
        });
    }
  const names = new Set(manifests.map(({ manifest }) => manifest.name));
  return manifests.map(({ dir, manifest }) => {
    const declared = declaredDependencies(manifest).filter((name) =>
      names.has(name)
    );
    return {
      name: manifest.name,
      dir,
      declared: new Set(declared),
      srcEdges: new Set(listedSrcEdges(root, dir) ?? declared),
      srcFiles: productionFilesUnder(join(root, dir, 'src'))
        .filter((file) => !file.endsWith('.md'))
        .map((file) => toRepoPath(root, file)),
    };
  });
}
