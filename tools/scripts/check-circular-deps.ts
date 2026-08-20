#!/usr/bin/env bun
/**
 * Fail-fast guardrail: forbid package-level circular dependencies between
 * `@apps|@libs|@pkgs/*` workspace packages.
 *
 * Why a custom script instead of `dependency-cruiser`'s `no-circular` rule:
 * - depcruise's `doNotFollow.path: 'node_modules'` skips workspace symlinks,
 *   so cross-package `@apps|@libs|@pkgs/<name>` imports are never traversed
 *   (bun resolves workspace packages through node_modules symlinks).
 * - Its `to: { circular: true }` matcher detects FILE-level cycles only. A
 *   package-level cycle (e.g. chess <-> spaces) can exist with zero
 *   file-level cycle chains, so depcruise reports a clean graph while the
 *   workspace is structurally circular.
 *
 * Algorithm:
 * 1. Discover every workspace package (`apps|libs|pkgs/<name>/package.json`
 *    named `@apps|@libs|@pkgs/<name>`).
 * 2. Scan each package's source files for `@apps|@libs|@pkgs/<other>`
 *    imports.
 * 3. Build a directed package -> package graph (edges annotated with sample
 *    importer files for actionable error reports).
 * 4. Run Tarjan's SCC; any component of size > 1 is a cycle.
 */
import {
  buildPackageImportGraph,
  discoverPackages,
  type PackageImportGraph,
  type PackageName,
} from './workspace-package-import-graph';

type Scc = PackageName[];

// Tarjan's SCC. Iterative to avoid blowing the call stack on large graphs.
function findStronglyConnectedComponents(graph: PackageImportGraph): Scc[] {
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

function describeCycle(scc: Scc, graph: PackageImportGraph): string[] {
  const lines: string[] = [];
  const sorted = [...scc].sort();
  lines.push(`  Cycle: ${sorted.join(' <-> ')}`);
  const inScc = new Set(scc);
  for (const from of sorted) {
    const edges = graph.get(from);
    if (!edges) continue;
    const targets = [...edges.keys()].filter((t) => inScc.has(t)).sort();
    for (const to of targets) {
      lines.push(`    ${from} -> ${to}`);
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
      'check:circular-deps: no @apps|@libs|@pkgs/* packages found under apps/, libs/, pkgs/.'
    );
    process.exit(1);
  }

  const graph = buildPackageImportGraph(packages);
  const cycles = findStronglyConnectedComponents(graph);

  if (cycles.length === 0) {
    console.log(
      `check:circular-deps OK — ${packages.size} packages scanned, no package-level cycles.`
    );
    process.exit(0);
  }

  console.error(
    `check:circular-deps FAILED — ${cycles.length} package-level cycle(s) detected:\n`
  );
  for (const scc of cycles) {
    for (const line of describeCycle(scc, graph)) console.error(line);
    console.error('');
  }
  console.error(
    'Break the cycle by moving shared types/logic into a leaf package (e.g. @pkgs/assert / @pkgs/keyword), inverting a dependency, or merging the packages.'
  );
  process.exit(1);
}

main();
