#!/usr/bin/env bun
/**
 * Fail-fast guardrail: forbid package-level circular dependencies between
 * `@gamezilla/*` workspace packages.
 *
 * Why a custom script instead of `dependency-cruiser`'s `no-circular` rule:
 * - depcruise's `doNotFollow.path: 'node_modules'` skips workspace symlinks,
 *   so cross-package `@gamezilla/<name>` imports are never traversed (bun
 *   resolves workspace packages through node_modules symlinks).
 * - Its `to: { circular: true }` matcher detects FILE-level cycles only. A
 *   package-level cycle (e.g. chess <-> spaces) can exist with zero
 *   file-level cycle chains, so depcruise reports a clean graph while the
 *   workspace is structurally circular.
 *
 * Algorithm:
 * 1. Discover every workspace package (`packages/<name>/package.json` named
 *    `@gamezilla/<name>`).
 * 2. Scan each package's source files for `@gamezilla/<other>` imports.
 * 3. Build a directed package -> package graph (edges annotated with sample
 *    importer files for actionable error reports).
 * 4. Run Tarjan's SCC; any component of size > 1 is a cycle.
 */
import { Glob } from 'bun';
import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const REPO_ROOT = join(import.meta.dirname, '..');
const SCOPE = '@gamezilla/';
const MAX_IMPORTER_SAMPLES = 3;

// Matches `from '@gamezilla/<name>'`, `import('@gamezilla/<name>')`, and
// `require('@gamezilla/<name>')`. The capture group is the package short
// name (everything after the scope, up to the next path separator/quote).
const IMPORT_PATTERN =
  /(?:\bfrom|\bimport\s*\(|\brequire\s*\()\s*['"]@gamezilla\/([^/'"\s)]+)/g;

type PackageName = string;

type EdgeSamples = Map<PackageName, string[]>;
type Graph = Map<PackageName, EdgeSamples>;

function discoverPackages(): Map<PackageName, string> {
  const packages = new Map<PackageName, string>();
  const glob = new Glob('packages/*/package.json');
  for (const rel of glob.scanSync({ cwd: REPO_ROOT, absolute: false })) {
    const abs = join(REPO_ROOT, rel);
    let pkg: { name?: unknown };
    try {
      pkg = JSON.parse(readFileSync(abs, 'utf8')) as { name?: unknown };
    } catch {
      continue;
    }
    if (typeof pkg.name !== 'string') continue;
    if (!pkg.name.startsWith(SCOPE)) continue;
    const shortName = pkg.name.slice(SCOPE.length);
    packages.set(shortName, join(abs, '..'));
  }
  return packages;
}

function buildGraph(packages: Map<PackageName, string>): Graph {
  const graph: Graph = new Map();
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

type Scc = PackageName[];

// Tarjan's SCC. Iterative to avoid blowing the call stack on large graphs.
function findStronglyConnectedComponents(graph: Graph): Scc[] {
  const index = new Map<PackageName, number>();
  const lowlink = new Map<PackageName, number>();
  const onStack = new Set<PackageName>();
  const tarjanStack: PackageName[] = [];
  const sccs: Scc[] = [];
  let next = 0;

  type Frame = { node: PackageName; iter: Iterator<PackageName> };
  const callStack: Frame[] = [];

  const pushNode = (node: PackageName) => {
    index.set(node, next);
    lowlink.set(node, next);
    next += 1;
    tarjanStack.push(node);
    onStack.add(node);
    const edges = graph.get(node);
    const neighbors = edges ? edges.keys() : [].values();
    callStack.push({ node, iter: neighbors });
  };

  for (const start of graph.keys()) {
    if (index.has(start)) continue;
    pushNode(start);

    while (callStack.length > 0) {
      const frame = callStack[callStack.length - 1];
      if (!frame) break;
      const step = frame.iter.next();
      if (step.done) {
        const v = frame.node;
        if (lowlink.get(v) === index.get(v)) {
          const scc: PackageName[] = [];
          while (tarjanStack.length > 0) {
            const w = tarjanStack.pop();
            if (w === undefined) break;
            onStack.delete(w);
            scc.push(w);
            if (w === v) break;
          }
          if (scc.length > 1) sccs.push(scc);
        }
        callStack.pop();
        const parent = callStack[callStack.length - 1];
        if (parent) {
          const parentLow = lowlink.get(parent.node) ?? 0;
          const childLow = lowlink.get(v) ?? 0;
          lowlink.set(parent.node, Math.min(parentLow, childLow));
        }
        continue;
      }
      const w = step.value;
      if (!index.has(w)) {
        pushNode(w);
      } else if (onStack.has(w)) {
        const vLow = lowlink.get(frame.node) ?? 0;
        const wIndex = index.get(w) ?? 0;
        lowlink.set(frame.node, Math.min(vLow, wIndex));
      }
    }
  }
  return sccs;
}

function describeCycle(scc: Scc, graph: Graph): string[] {
  const lines: string[] = [];
  const sorted = [...scc].sort();
  lines.push(`  Cycle: ${sorted.map((n) => `@gamezilla/${n}`).join(' <-> ')}`);
  const inScc = new Set(scc);
  for (const from of sorted) {
    const edges = graph.get(from);
    if (!edges) continue;
    const targets = [...edges.keys()].filter((t) => inScc.has(t)).sort();
    for (const to of targets) {
      lines.push(`    @gamezilla/${from} -> @gamezilla/${to}`);
      const importers = edges.get(to) ?? [];
      for (const importer of importers) {
        lines.push(`      via ${importer}`);
      }
    }
  }
  return lines;
}

function main(): never {
  const packages = discoverPackages();
  if (packages.size === 0) {
    console.error(
      'check:circular-deps: no @gamezilla/* packages found under packages/.',
    );
    process.exit(1);
  }

  const graph = buildGraph(packages);
  const cycles = findStronglyConnectedComponents(graph);

  if (cycles.length === 0) {
    console.log(
      `check:circular-deps OK — ${packages.size} packages scanned, no package-level cycles.`,
    );
    process.exit(0);
  }

  console.error(
    `check:circular-deps FAILED — ${cycles.length} package-level cycle(s) detected:\n`,
  );
  for (const scc of cycles) {
    for (const line of describeCycle(scc, graph)) console.error(line);
    console.error('');
  }
  console.error(
    'Break the cycle by moving shared types/logic into a leaf package (e.g. @gamezilla/lib), inverting a dependency, or merging the packages.',
  );
  process.exit(1);
}

main();
