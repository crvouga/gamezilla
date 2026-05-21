import { assert } from '@gamezilla/assert';
import type { Resource } from './types';

/**
 * Kahn's algorithm: returns resources ordered so that every resource
 * appears after all of its dependencies.
 */
export function topoSort(resources: readonly Resource[]): Resource[] {
  const byId = new Map<string, Resource>();
  for (const r of resources) {
    assert.ok(!byId.has(r.id), `topoSort: duplicate resource id "${r.id}"`);
    byId.set(r.id, r);
  }

  const inDegree = new Map<string, number>();
  const dependents = new Map<string, string[]>();
  for (const r of resources) {
    inDegree.set(r.id, 0);
    dependents.set(r.id, []);
  }

  for (const r of resources) {
    for (const dep of r.dependencyIds()) {
      assert.ok(
        byId.has(dep),
        `topoSort: resource "${r.id}" depends on unknown resource "${dep}"`
      );
      inDegree.set(r.id, (inDegree.get(r.id) ?? 0) + 1);
      dependents.get(dep)!.push(r.id);
    }
  }

  const queue: string[] = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }

  const sorted: Resource[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    sorted.push(byId.get(id)!);
    for (const child of dependents.get(id)!) {
      const next = inDegree.get(child)! - 1;
      inDegree.set(child, next);
      if (next === 0) queue.push(child);
    }
  }

  assert.ok(
    sorted.length === resources.length,
    `topoSort: cycle detected — only ${sorted.length} of ${resources.length} resources could be ordered`
  );

  return sorted;
}
