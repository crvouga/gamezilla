import {
  coerceSystemNodeKind,
  fallbackReportNodes,
} from '../shared/system-node';
import type { SimulationReportTopology } from '../types';
import type { FlatFrame } from './frames';
import type { NodeViewKind } from './router';

export type TopologyNodeInfo = {
  readonly id: string;
  readonly kind: string;
  readonly attributes: readonly string[];
};

/** Prefer topology nodes; else api/events + actors while topology loads. */
export function resolveNodeList(args: {
  readonly topology: SimulationReportTopology | null;
  readonly actorIds: readonly string[];
}): readonly TopologyNodeInfo[] {
  if (args.topology != null && args.topology.nodes.length > 0) {
    return args.topology.nodes.map((n) => ({
      id: n.id,
      kind: n.kind,
      attributes: n.attributes,
    }));
  }
  return fallbackReportNodes(args.actorIds);
}

export function viewsForNode(node: TopologyNodeInfo | null): NodeViewKind[] {
  if (node == null) return [];
  const attrs = new Set(node.attributes);
  const views: NodeViewKind[] = [];
  if (attrs.has('html') || coerceSystemNodeKind(node.kind) === 'client') {
    views.push('html');
  }
  if (attrs.has('sqlite')) views.push('sqlite');
  if (attrs.has('ingress') || attrs.has('egress')) views.push('events');
  return views;
}

export function defaultViewFor(
  views: readonly NodeViewKind[]
): NodeViewKind | null {
  if (views.includes('html')) return 'html';
  if (views.includes('sqlite')) return 'sqlite';
  if (views.includes('events')) return 'events';
  return null;
}

export function resolveSelectedView(
  navView: NodeViewKind | null,
  views: readonly NodeViewKind[]
): NodeViewKind | null {
  if (navView != null && views.includes(navView)) return navView;
  return defaultViewFor(views);
}

/** HTML blob path for a node on this frame (attributes → views → legacy file). */
export function resolveHtmlFile(
  frame: FlatFrame | null,
  nodeId: string | null,
  node: TopologyNodeInfo | null
): string | null {
  if (frame == null || nodeId == null) return null;
  const fromAttr = frame.attributes?.find(
    (a) => a.kind === 'html' && a.nodeId === nodeId && a.file
  );
  if (fromAttr?.file) return fromAttr.file;
  const fromView = frame.views?.find((v) => v.nodeId === nodeId);
  if (fromView) return fromView.file;
  const wantsHtml =
    node != null &&
    (node.attributes.includes('html') ||
      coerceSystemNodeKind(node.kind) === 'client');
  if (wantsHtml && frame.file) return frame.file;
  return null;
}

export function defaultNodeId(
  nodes: readonly TopologyNodeInfo[]
): string | null {
  const withHtml = nodes.find(
    (n) =>
      n.attributes.includes('html') || coerceSystemNodeKind(n.kind) === 'client'
  );
  return withHtml?.id ?? nodes[0]?.id ?? null;
}
