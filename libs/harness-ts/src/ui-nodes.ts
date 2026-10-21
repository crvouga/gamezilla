/**
 * Node lookup shared by product UI actions (writes) and observations (reads).
 * A path is a chain of testIds resolved against one actor's live driver.
 */

import type { DriverNode } from '@pkgs/ui-testing-root-shared-ts/driver';

import type { ProductHarness } from './harness';

export function nodeAt(
  s: ProductHarness,
  actorId: string,
  path: readonly string[]
): DriverNode | null {
  const handle = s.actors.get(actorId);
  if (handle === undefined) return null;
  const [head, ...rest] = path;
  let node = handle.ui.get(head ?? '');
  for (const segment of rest) node = node.get(segment);
  return node;
}

/** Stable observation-name suffix so memoisation keys stay per node. */
export function nodeKey(actorId: string, path: readonly string[]): string {
  return `${actorId}/${path.join('>')}`;
}
