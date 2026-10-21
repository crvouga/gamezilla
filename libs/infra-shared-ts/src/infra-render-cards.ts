/**
 * Turn a stack of the model into graph cards: one per module (collapsed to
 * what it is made of) and per resource declared in the stack itself, with
 * edges between them derived from the resource-level dependencies.
 */

import type { LayoutEdge } from './infra-layout';
import type { NodeModel, StackModel } from './infra-model-types';
import type { Card } from './infra-render-graph';
import { moduleAnchor, plural, resourceAnchor } from './infra-render-text';

export type CardGraph = {
  readonly cards: readonly Card[];
  readonly edges: readonly LayoutEdge[];
};

const PLUMBING = new Set(['opentofu', 'hashicorp']);

function instanceCount(node: NodeModel): number {
  return node.expansion === 'unknown' ? 1 : node.instances.length;
}

export function nodeLabel(node: NodeModel): string {
  const first = node.instances[0];
  if (node.expansion === 'for_each' || node.expansion === 'count') {
    if (node.instances.length === 0) return 'none in this environment';
    if (node.instances.length > 1) {
      return `${first?.label ?? node.name} +${node.instances.length - 1}`;
    }
  }
  if (node.expansion === 'unknown') return `${node.name} (one per item)`;
  return first?.label ?? node.name;
}

/** The provider marks of a module: most used first, plumbing last. */
function logosOf(nodes: readonly NodeModel[]): string[] {
  const counts = new Map<string, number>();
  for (const node of nodes) {
    if (node.mode === 'data' && node.category === 'Plumbing') continue;
    counts.set(node.logo, (counts.get(node.logo) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort(
      (a, b) =>
        Number(PLUMBING.has(a[0])) - Number(PLUMBING.has(b[0])) || b[1] - a[1]
    )
    .map(([id]) => id);
}

function moduleCard(
  env: string | null,
  stack: StackModel,
  name: string,
  nodes: readonly NodeModel[]
): Card | null {
  const managed = nodes.filter(
    (n) => n.mode === 'managed' && n.category !== 'Plumbing'
  );
  if (managed.length === 0) return null;
  const instances = managed.reduce((sum, n) => sum + instanceCount(n), 0);
  const count = plural(managed.length, 'resource');
  const subtitle =
    instances === managed.length ? count : `${count} · ${instances} instances`;
  return {
    id: `module.${name}`,
    title: name,
    subtitle,
    logos: logosOf(nodes),
    href: `#${moduleAnchor(env, stack.stack, name)}`,
    tone: 'managed',
    stateful: managed.some((n) => n.stateful),
    tooltip: `${name}: ${subtitle}`,
  };
}

function rootCard(
  env: string | null,
  stack: StackModel,
  node: NodeModel
): Card {
  return {
    id: node.address,
    title: node.title,
    subtitle: nodeLabel(node),
    logos: [node.logo],
    href: `#${resourceAnchor(env, stack.stack, node.address)}`,
    tone: node.mode === 'data' ? 'data' : 'managed',
    stateful: node.stateful && node.mode === 'managed',
    tooltip: node.address,
  };
}

function groupOf(node: NodeModel): string {
  return node.group === '' ? node.address : `module.${node.group}`;
}

function externalCards(stack: StackModel): {
  cards: Card[];
  edges: LayoutEdge[];
} {
  const cards = new Map<string, Card>();
  const edges: LayoutEdge[] = [];
  for (const node of stack.nodes) {
    for (const external of node.externals) {
      const id = `external:${external.title}:${external.name}`;
      cards.set(id, {
        id,
        title: external.title,
        subtitle: external.name,
        logos: [external.logo],
        href: null,
        tone: 'external',
        stateful: false,
        tooltip: `${external.name} — ${external.note}`,
      });
      edges.push({ from: groupOf(node), to: id });
    }
  }
  return { cards: [...cards.values()], edges };
}

/** Root-level resources that only carry values; they are not shown. */
function hiddenAddresses(stack: StackModel): Set<string> {
  return new Set(
    stack.nodes
      .filter((n) => n.group === '' && n.category === 'Plumbing')
      .map((n) => n.address)
  );
}

/** Edges with hidden nodes spliced out: A → hidden → B becomes A → B. */
function bridged(
  edges: readonly { from: string; to: string }[],
  hidden: ReadonlySet<string>
): { from: string; to: string }[] {
  let current = [...edges];
  for (const id of hidden) {
    const into = current.filter((e) => e.to === id);
    const out = current.filter((e) => e.from === id);
    current = current.filter((e) => e.from !== id && e.to !== id);
    for (const i of into) {
      for (const o of out) current.push({ from: i.from, to: o.to });
    }
  }
  return current;
}

export function overviewGraph(
  env: string | null,
  stack: StackModel
): CardGraph {
  const hidden = hiddenAddresses(stack);
  const byGroup = new Map<string, NodeModel[]>();
  for (const node of stack.nodes) {
    if (hidden.has(node.address)) continue;
    byGroup.set(node.group, [...(byGroup.get(node.group) ?? []), node]);
  }
  const cards: Card[] = [];
  for (const [group, nodes] of byGroup) {
    if (group === '') {
      cards.push(...nodes.map((n) => rootCard(env, stack, n)));
      continue;
    }
    const card = moduleCard(env, stack, group, nodes);
    if (card !== null) cards.push(card);
  }
  const owner = new Map(stack.nodes.map((n) => [n.address, groupOf(n)]));
  const edges: LayoutEdge[] = [];
  for (const edge of bridged(stack.edges, hidden)) {
    const from = owner.get(edge.from);
    const to = owner.get(edge.to);
    if (from !== undefined && to !== undefined && from !== to) {
      edges.push({ from, to });
    }
  }
  const external = externalCards(stack);
  const ids = new Set(cards.map((c) => c.id));
  const kept = edges.filter((e) => ids.has(e.from) && ids.has(e.to));
  return {
    cards: [...cards, ...external.cards],
    edges: [...kept, ...external.edges.filter((e) => ids.has(e.from))],
  };
}

function detailCard(
  env: string | null,
  stack: StackModel,
  node: NodeModel
): Card {
  return {
    id: node.address,
    title: node.title,
    subtitle: nodeLabel(node),
    logos: [node.logo],
    href: `#${resourceAnchor(env, stack.stack, node.address)}`,
    tone: node.mode === 'data' ? 'data' : 'managed',
    stateful: node.stateful && node.mode === 'managed',
    tooltip: node.address,
  };
}

export function moduleGraph(
  env: string | null,
  stack: StackModel,
  addresses: readonly string[]
): CardGraph {
  const inside = new Set(addresses);
  const cards = stack.nodes
    .filter((n) => inside.has(n.address))
    .map((n) => detailCard(env, stack, n));
  const edges = stack.edges.filter(
    (e) => inside.has(e.from) && inside.has(e.to)
  );
  return { cards, edges };
}
