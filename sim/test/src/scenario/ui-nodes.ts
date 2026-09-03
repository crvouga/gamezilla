/**
 * Node lookup shared by product UI actions (writes) and observations (reads).
 * A path is a chain of testIds resolved against one actor's live driver.
 */

import type { DriverNode } from '@pkgs/ui-testing';

import type { ProductSurface } from './surface';

export function nodeAt(
  s: ProductSurface,
  actorId: string,
  path: readonly string[]
): DriverNode | null {
  const handle = s.actors.get(actorId);
  if (handle === undefined) return null;
  let node = handle.ui.get(path[0] ?? '');
  for (let i = 1; i < path.length; i += 1) {
    node = node.get(path[i]!);
  }
  return node;
}

/** Stable observation-name suffix so memoisation keys stay per node. */
export function nodeKey(actorId: string, path: readonly string[]): string {
  return `${actorId}/${path.join('>')}`;
}
