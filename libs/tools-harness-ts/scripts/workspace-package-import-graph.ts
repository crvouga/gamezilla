// @io-wall-ok — reads package sources for the dependency report.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, posix } from 'node:path';
import { readGraph } from './cache-graph';
import { sourceImports } from './source-imports';

export const REPO_ROOT = join(import.meta.dirname, '../../..');
export type PackageEdges = ReadonlyMap<string, readonly string[]>;

function importedPackage(file: string, specifier: string): string {
  if (specifier.startsWith('.')) {
    const [tier, folder] = posix
      .normalize(posix.join(posix.dirname(file), specifier))
      .split('/');
    return `@${tier}/${folder}`;
  }
  return specifier.split('/', 2).join('/');
}

type Scope = 'src' | 'all' | 'declared';

function trackedModules(root: string): Map<string, string[]> {
  const paths = execFileSync(
    'git',
    ['ls-files', '-z', '--', 'apps', 'libs', 'pkgs'],
    { cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }
  );
  const byPackage = new Map<string, string[]>();
  for (const file of paths.split('\0')) {
    if (!/\.[cm]?[jt]sx?$/.test(file) || !existsSync(join(root, file)))
      continue;
    const dir = file.split('/', 2).join('/');
    const group = byPackage.get(dir) ?? [];
    group.push(file);
    byPackage.set(dir, group);
  }
  return byPackage;
}

export type FileImports = ReadonlyMap<string, readonly string[]>;

export function workspaceImports(root: string, scope: 'all' | 'src') {
  const tracked = scope === 'all' ? trackedModules(root) : undefined;
  const workspace = new Map<string, FileImports>();
  for (const pkg of readGraph(root)) {
    const files = tracked ? (tracked.get(pkg.dir) ?? []) : pkg.srcFiles;
    const imports = new Map<string, string[]>();
    for (const file of files) {
      if (!/\.[cm]?[jt]sx?$/.test(file) || /\.d\.[cm]?ts$/.test(file)) continue;
      const references = sourceImports(
        readFileSync(join(root, file), 'utf8'),
        file
      );
      imports.set(
        file,
        references.filter((ref) => !ref.typeOnly).map((ref) => ref.specifier)
      );
    }
    workspace.set(pkg.name, imports);
  }
  return workspace;
}

export function packageImportEdges(
  workspace: ReadonlyMap<string, FileImports>
): PackageEdges {
  const graph = new Map<string, string[]>();
  for (const [owner, imports] of workspace) {
    const targets = new Set<string>();
    for (const [file, references] of imports)
      for (const specifier of references) {
        const target = importedPackage(file, specifier);
        if (target !== owner && workspace.has(target)) targets.add(target);
      }
    graph.set(owner, [...targets].sort());
  }
  return graph;
}

export function packageEdges(root: string, scope: Scope): PackageEdges {
  if (scope !== 'declared')
    return packageImportEdges(workspaceImports(root, scope));
  return new Map(
    readGraph(root).map((pkg) => [pkg.name, [...pkg.declared].sort()])
  );
}

function reachable(graph: PackageEdges, name: string): Set<string> {
  const seen = new Set([name]);
  for (const from of seen)
    for (const target of graph.get(from) ?? []) seen.add(target);
  return seen;
}

/** Emit each mutually reachable group once. A package can also depend on itself in a manifest. */
export function cycleGroups(graph: PackageEdges): string[][] {
  const closures = new Map(
    [...graph.keys()].map((name) => [name, reachable(graph, name)])
  );
  const seen = new Set<string>();
  const groups: string[][] = [];
  for (const [name, closure] of closures) {
    if (seen.has(name)) continue;
    const group = [...closure]
      .filter((other) => closures.get(other)?.has(name))
      .sort();
    for (const member of group) seen.add(member);
    if (group.length > 1 || graph.get(name)?.includes(name)) groups.push(group);
  }
  return groups;
}

export function packageReport(graph: PackageEdges, focus?: string) {
  const dependents = new Map(
    [...graph.keys()].map((name) => [name, new Array<string>()])
  );
  for (const [name, targets] of graph)
    for (const target of targets) dependents.get(target)?.push(name);
  if (focus !== undefined) {
    const dependencies = graph.get(focus);
    if (!dependencies) throw new Error(`Unknown workspace package: ${focus}`);
    return {
      name: focus,
      dependencies,
      dependents: dependents.get(focus)?.sort(),
    };
  }
  const ranked = (edges: PackageEdges) =>
    [...edges]
      .map(([name, list]) => ({ name, count: list.length }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'en'))
      .slice(0, 10);
  return {
    packages: graph.size,
    edges: [...graph.values()].reduce((count, list) => count + list.length, 0),
    cycleGroups: cycleGroups(graph),
    mostDependencies: ranked(graph),
    mostDependents: ranked(dependents),
  };
}
