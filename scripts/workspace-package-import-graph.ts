/**
 * Package-level graph of @apps|@libs|@pkgs / * imports discovered from source.
 * Shared by ci:circular-deps and deps:graph.
 */
import { Glob } from 'bun';
import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

export const REPO_ROOT = join(import.meta.dirname, '..');
const SCOPES = ['@apps/', '@libs/', '@pkgs/'] as const;
const TIER_DIRS = ['apps', 'libs', 'pkgs'] as const;
const MAX_IMPORTER_SAMPLES = 3;

export type PackageName = string;

/** from -> to -> sample importer paths (relative to repo root) */
export type PackageImportGraph = Map<PackageName, Map<PackageName, string[]>>;

export const IMPORT_PATTERN =
  /(?:\bfrom|\bimport\s*\(|\brequire\s*\()\s*['"]@(?:apps|libs|pkgs)\/([^/'"\s)]+)/g;

export function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:\\])\/\/[^\n]*/g, (_full, prefix: string) => prefix);
}

export function stripTypeOnlyImports(source: string): string {
  return source.replace(
    /\b(?:import|export)\s+type\s+(?:\*\s+as\s+\w+|\w+(?:\s*,\s*\{[^}]*\})?|\{[^}]*\})\s+from\s*['"][^'"]+['"]\s*;?/g,
    (m) => m.replace(/[^\n]/g, ' ')
  );
}

export function discoverPackages(): Map<PackageName, string> {
  const packages = new Map<PackageName, string>();
  for (const tier of TIER_DIRS) {
    const glob = new Glob(`${tier}/*/package.json`);
    for (const rel of glob.scanSync({ cwd: REPO_ROOT, absolute: false })) {
      const abs = join(REPO_ROOT, rel);
      let pkg: { name?: unknown };
      try {
        pkg = JSON.parse(readFileSync(abs, 'utf8')) as { name?: unknown };
      } catch {
        continue;
      }
      if (typeof pkg.name !== 'string') continue;
      const matchedScope = SCOPES.find(
        (s) => typeof pkg.name === 'string' && pkg.name.startsWith(s)
      );
      if (matchedScope === undefined) continue;
      const shortName = (pkg.name as string).slice(matchedScope.length);
      packages.set(shortName, join(abs, '..'));
    }
  }
  return packages;
}

export function buildPackageImportGraph(
  packages: Map<PackageName, string>
): PackageImportGraph {
  const graph: PackageImportGraph = new Map();
  for (const name of packages.keys()) graph.set(name, new Map());

  for (const [pkgName, pkgDir] of packages) {
    const glob = new Glob('**/*.{ts,tsx,mts,cts}');
    for (const rel of glob.scanSync({ cwd: pkgDir, absolute: false })) {
      if (rel.startsWith('node_modules/')) continue;
      if (rel.startsWith('dist/')) continue;
      if (rel.startsWith('.turbo/')) continue;

      const filePath = join(pkgDir, rel);
      let source: string;
      try {
        source = readFileSync(filePath, 'utf8');
      } catch {
        continue;
      }
      source = stripComments(source);
      source = stripTypeOnlyImports(source);

      for (const match of source.matchAll(IMPORT_PATTERN)) {
        const target = match[1];
        if (!target) continue;
        if (target === pkgName) continue;
        if (!packages.has(target)) continue;

        const edges = graph.get(pkgName);
        if (!edges) continue;
        let importers = edges.get(target);
        if (!importers) {
          importers = [];
          edges.set(target, importers);
        }
        if (importers.length < MAX_IMPORTER_SAMPLES) {
          importers.push(relative(REPO_ROOT, filePath));
        }
      }
    }
  }
  return graph;
}
