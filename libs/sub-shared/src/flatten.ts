/**
 * Pre-order walk shared by the data, client, and server folds.
 *
 * A node is ordered before the subs it contains, and each sub is walked in
 * listed order. The same object re-entered on the stack fails before the
 * name check, so a cycle is not reported as a duplicate and cannot loop.
 * Returned nodes are the originals: walking the result again visits children
 * again, so each fold walks the roots it was given.
 */

import { assert } from '@pkgs/assert-root-shared/singleton';

type SubNode<T extends { readonly name: string }> = T & {
  readonly subs?: readonly SubNode<T>[] | undefined;
};

export function flattenSubs<T extends { readonly name: string }>(
  nodes: readonly SubNode<T>[],
  label: string
): SubNode<T>[] {
  const flat: SubNode<T>[] = [];
  const names = new Set<string>();
  const stack = new Set<SubNode<T>>();
  const visit = (node: SubNode<T>): void => {
    assert.ok(!stack.has(node), `${label}: walk re-enters '${node.name}'`);
    assert.ok(!names.has(node.name), `${label}: duplicate sub '${node.name}'`);
    stack.add(node);
    names.add(node.name);
    flat.push(node);
    for (const child of node.subs ?? []) visit(child);
    stack.delete(node);
  };
  for (const node of nodes) visit(node);
  return flat;
}
