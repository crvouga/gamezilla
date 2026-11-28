// @io-wall-ok — audits tracked workspace module references for Nightly.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { slashPath } from '@pkgs/os-shared-ts/slash-path';
import { resolveExports } from 'resolve-pkg-maps';
import type { WorkspaceExports } from './private-package-imports';
import {
  cycleGroups,
  type FileImports,
  packageImportEdges,
  REPO_ROOT,
  workspaceImports,
} from './workspace-package-import-graph';

function localTarget(
  specifier: string,
  importer: string,
  pkg: {
    dir: string;
    name: string;
    manifest: WorkspaceExports;
  }
): string | undefined {
  try {
    if (specifier.startsWith('.'))
      return Bun.resolveSync(specifier, dirname(importer));
    if (pkg.manifest.exports) {
      const paths = resolveExports(
        pkg.manifest.exports,
        specifier.slice(pkg.name.length + 1),
        ['bun', 'node', 'import']
      );
      return paths
        .map((path) => join(pkg.dir, path))
        .find((path) => existsSync(path));
    }
  } catch {
    // A missing file or private subpath has no resolved module edge.
  }
  return undefined;
}

function packageModuleEdges(root: string, owner: string, imports: FileImports) {
  const edges = new Map<string, string[]>();
  const unresolved = new Set<string>();
  if (imports.size === 0) return { edges, unresolved };
  const dir = join(root, owner.slice(1));
  const manifest = JSON.parse(
    readFileSync(join(dir, 'package.json'), 'utf8')
  ) as WorkspaceExports;
  const pkg = { name: owner, dir, manifest };
  for (const [file, references] of imports) {
    const targets = new Set<string>();
    for (const specifier of references) {
      if (
        !specifier.startsWith('.') &&
        specifier !== owner &&
        !specifier.startsWith(owner + '/')
      )
        continue;
      const path = localTarget(specifier, join(root, file), pkg);
      if (path === undefined) unresolved.add(`${file} -> ${specifier}`);
      else {
        const target = slashPath(relative(root, path));
        if (imports.has(target)) targets.add(target);
      }
    }
    edges.set(file, [...targets]);
  }
  return { edges, unresolved };
}

export function verifyRuntimeCycles(root: string): string {
  const workspace = workspaceImports(root, 'all');
  const packages = packageImportEdges(workspace);
  const packageCycles = cycleGroups(packages);
  const moduleCycles: string[][] = [];
  const missing: string[] = [];
  let files = 0;
  let edges = 0;
  for (const [owner, imports] of workspace) {
    const { edges: graph, unresolved } = packageModuleEdges(
      root,
      owner,
      imports
    );
    missing.push(...unresolved);
    files += graph.size;
    for (const targets of graph.values()) edges += targets.length;
    moduleCycles.push(...cycleGroups(graph));
  }
  const summary = [
    `${packages.size} workspace packages, ${packageCycles.length} package cycle groups`,
    `${files} tracked modules, ${edges} intra-package edges, ${moduleCycles.length} module cycle groups`,
    `${missing.length} unresolved relative or self-package references`,
    ...missing,
  ].join('\n');
  if (packageCycles.length || moduleCycles.length) {
    const groups = [...packageCycles, ...moduleCycles].map((group) =>
      group.join(', ')
    );
    throw new Error(
      [
        summary,
        'Remove a circular runtime import between these members:',
        ...groups,
      ].join('\n')
    );
  }
  return summary;
}

if (import.meta.main) console.log(verifyRuntimeCycles(REPO_ROOT));
