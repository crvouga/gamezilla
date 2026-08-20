/**
 * Group World topology nodes into debugger chrome kinds.
 * World `db` is folded into API (DB pane), not its own kind tab.
 */

import {
  coerceSystemChromeKind,
  coerceSystemNodeKind,
  parseSystemNodeAddress,
  type SystemChromeKind,
} from './system-node';

export type DebuggerNode = {
  readonly id: string;
  readonly kind: string;
  readonly attributes?: readonly string[];
};

export function chromeKindForNodeKind(kind: string): SystemChromeKind {
  const coerced = coerceSystemNodeKind(kind);
  if (coerced === 'db') return 'api';
  return coerceSystemChromeKind(coerced);
}

/** Nodes shown as instance tabs for a chrome kind (`db` omitted). */
export function instancesForKind<T extends DebuggerNode>(
  nodes: readonly T[],
  kind: SystemChromeKind
): readonly T[] {
  return nodes.filter((n) => {
    if (coerceSystemNodeKind(n.kind) === 'db') return false;
    return chromeKindForNodeKind(n.kind) === kind;
  });
}

/** Full World address from chrome kind + instance URL param. */
export function nodeIdForKindInstance(
  kind: SystemChromeKind,
  instance: string | null | undefined
): string {
  const raw = instance?.trim() ?? '';
  if (kind === 'api') return 'api';
  if (kind === 'events') return 'events';
  if (raw.length === 0) return kind;
  const parsed = parseSystemNodeAddress(raw);
  if (parsed.kind === kind || coerceSystemNodeKind(raw) === kind) {
    return raw.includes(':') ? raw : `${kind}:${raw}`;
  }
  if (raw.includes(':')) return raw;
  return `${kind}:${raw}`;
}

/** Short instance id for URL (`client:alice` → `alice`). */
export function instanceParamForNodeId(nodeId: string): string {
  const parsed = parseSystemNodeAddress(nodeId);
  return parsed.instanceId ?? parsed.kind;
}

/** Resolve a topology node from a URL instance param (short or full id). */
export function findNodeForInstance<T extends DebuggerNode>(
  nodes: readonly T[],
  kind: SystemChromeKind,
  instance: string | null | undefined
): T | undefined {
  const list = instancesForKind(nodes, kind);
  if (list.length === 0) return undefined;
  const raw = instance?.trim() ?? '';
  if (raw.length === 0) return list[0];
  return (
    list.find((n) => n.id === raw) ??
    list.find((n) => instanceParamForNodeId(n.id) === raw) ??
    list.find((n) => n.id === nodeIdForKindInstance(kind, raw)) ??
    list[0]
  );
}

export function sqliteNodeIdForApi(nodes: readonly DebuggerNode[]): string {
  const api = nodes.find((n) => coerceSystemNodeKind(n.kind) === 'api');
  if (api !== undefined) return api.id;
  const db = nodes.find((n) => coerceSystemNodeKind(n.kind) === 'db');
  return db?.id ?? 'api';
}
