/**
 * Named CLI dependency for monorepo tooling installers (`bun install-deps`).
 * Strategies that actually fetch/install binaries implement {@link Installer};
 * {@link CliDep} layers identity + dependency edges + async install-or-upgrade.
 */
export type CliDep = {
  readonly id: string;
  readonly dependsOn: readonly string[];
  installOrUpgrade(): Promise<void>;
};

function indexCliDeps(deps: readonly CliDep[]): Map<string, CliDep> {
  const byId = new Map<string, CliDep>();
  for (const dep of deps) {
    if (byId.has(dep.id)) {
      throw new Error(`duplicate CliDep id: ${dep.id}`);
    }
    byId.set(dep.id, dep);
  }
  return byId;
}

function buildEdges(
  deps: readonly CliDep[],
  byId: Map<string, CliDep>
): {
  readonly indegree: Map<string, number>;
  readonly dependents: Map<string, string[]>;
} {
  const indegree = new Map<string, number>();
  const dependents = new Map<string, string[]>();
  for (const id of byId.keys()) {
    indegree.set(id, 0);
    dependents.set(id, []);
  }
  for (const dep of deps) {
    for (const parent of dep.dependsOn) {
      if (!byId.has(parent)) {
        throw new Error(`CliDep "${dep.id}" depends on unknown id "${parent}"`);
      }
      indegree.set(dep.id, (indegree.get(dep.id) ?? 0) + 1);
      dependents.get(parent)?.push(dep.id);
    }
  }
  return { indegree, dependents };
}

/**
 * Kahn topological sort of {@link CliDep} ids. Throws on unknown `dependsOn`
 * references, duplicate ids, or cycles.
 */
export function sortCliDeps(deps: readonly CliDep[]): CliDep[] {
  const byId = indexCliDeps(deps);
  const { indegree, dependents } = buildEdges(deps, byId);
  const queue = [...byId.keys()]
    .filter((id) => (indegree.get(id) ?? 0) === 0)
    .sort();
  const ordered: CliDep[] = [];

  while (queue.length > 0) {
    const id = queue.shift();
    if (id === undefined) break;
    const dep = byId.get(id);
    if (dep === undefined) continue;
    ordered.push(dep);
    for (const child of dependents.get(id) ?? []) {
      const next = (indegree.get(child) ?? 0) - 1;
      indegree.set(child, next);
      if (next === 0) {
        queue.push(child);
        queue.sort();
      }
    }
  }

  if (ordered.length !== deps.length) {
    const remaining = [...byId.keys()].filter(
      (id) => !ordered.some((d) => d.id === id)
    );
    throw new Error(`CliDep cycle involving: ${remaining.sort().join(', ')}`);
  }

  return ordered;
}

/** Install or upgrade each dep in topological order (sequential). */
export async function installCliDeps(deps: readonly CliDep[]): Promise<void> {
  for (const dep of sortCliDeps(deps)) {
    await dep.installOrUpgrade();
  }
}
