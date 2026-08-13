import type {
  EdgeDirection,
  EdgeLinkState,
  LiveEdgeSnapshot,
} from '../topology';
import { edgeKey } from './edge-key';
import type { EdgeRuntime, FailWithSpec } from './mesh-types';

export function getOrThrow(
  edges: Map<string, EdgeRuntime>,
  from: string,
  to: string
): EdgeRuntime {
  const edge = edges.get(edgeKey(from, to)) ?? edges.get(edgeKey(to, from));
  if (!edge) {
    throw new Error(`SimMesh: unknown edge ${from} ↔ ${to}`);
  }
  return edge;
}

export function toLiveSnapshot(edge: EdgeRuntime): LiveEdgeSnapshot {
  const state: EdgeLinkState =
    edge.stateFrom === 'down' || edge.stateTo === 'down'
      ? 'down'
      : edge.stateFrom === 'hold' || edge.stateTo === 'hold'
        ? 'hold'
        : 'ok';
  return {
    from: edge.from,
    to: edge.to,
    kind: edge.kind,
    state,
    latencyMs: edge.latencyMs,
    jitterMs: edge.jitterMs,
    dropRate: edge.dropRate,
    duplicateRate: edge.duplicateRate,
    failWithRemaining: edge.failWithRemaining,
  };
}

export function applyDirectionalState(
  edge: EdgeRuntime,
  direction: EdgeDirection,
  state: EdgeLinkState,
  hopFromPerspective: 'canonical'
): void {
  void hopFromPerspective;
  if (direction === 'both') {
    edge.stateFrom = state;
    edge.stateTo = state;
    return;
  }
  if (direction === 'from') {
    edge.stateFrom = state;
    return;
  }
  edge.stateTo = state;
}

/** Resolve link state for a message traveling from → to. */
export function hopState(
  edge: EdgeRuntime,
  from: string,
  to: string
): EdgeLinkState {
  // Canonical edge is stored as registered (edge.from → edge.to).
  // stateFrom = traffic leaving edge.from toward edge.to
  // stateTo = traffic leaving edge.to toward edge.from
  if (from === edge.from && to === edge.to) return edge.stateFrom;
  if (from === edge.to && to === edge.from) return edge.stateTo;
  return 'ok';
}

export function normalizeFailWith(
  spec: FailWithSpec | number | string
): FailWithSpec {
  if (typeof spec === 'number') {
    return { type: 'status', status: spec };
  }
  if (typeof spec === 'string') {
    return { type: 'error', error: spec };
  }
  return spec;
}

export function shuffleInPlace<T>(items: T[], random: () => number): void {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const tmp = items[i]!;
    items[i] = items[j]!;
    items[j] = tmp;
  }
}
