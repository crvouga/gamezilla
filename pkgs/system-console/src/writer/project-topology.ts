import type { WorldTopology } from '@pkgs/system';

import type { SimulationReportTopology } from '../types';

const CLIENT_ATTRS = ['html', 'sqlite', 'ingress', 'egress'] as const;
const API_ATTRS = ['sqlite', 'ingress', 'egress'] as const;
const DEFAULT_ATTRS = ['ingress', 'egress'] as const;

function attributesFor(kind: string): readonly string[] {
  if (kind === 'client') return CLIENT_ATTRS;
  if (kind === 'api' || kind === 'db') return API_ATTRS;
  return DEFAULT_ATTRS;
}

/**
 * Map a system-native {@link WorldTopology} into the persisted console
 * `topology.json` shape (attributes, zeroed network fields, seed/fuzz).
 */
export function projectReportTopology(
  topology: WorldTopology,
  seed: string
): SimulationReportTopology {
  const kinds = new Map<string, readonly string[]>();
  for (const n of topology.nodes) {
    if (!kinds.has(n.kind)) kinds.set(n.kind, attributesFor(n.kind));
  }

  const nodes = topology.nodes.map((n) => ({
    id: n.address,
    kind: n.kind,
    status: n.down ? 'down' : 'ok',
    attributes: [...attributesFor(n.kind)],
    clockSkewMs: 0,
  }));

  return {
    seed,
    fuzz: null,
    definition: {
      kinds: Object.fromEntries(
        [...kinds.entries()].map(([kind, attributes]) => [
          kind,
          { attributes: [...attributes] },
        ])
      ),
      nodes: nodes.map((n) => ({ id: n.id, kind: n.kind })),
      edges: topology.edges.map((e) => ({
        from: e.from,
        to: e.to,
        kind: e.kind,
      })),
      spawn: topology.spawn,
    },
    nodes,
    edges: topology.edges.map((e) => ({
      from: e.from,
      to: e.to,
      kind: e.kind,
      state: e.partitioned ? 'down' : 'up',
      latencyMs: 0,
      jitterMs: 0,
      dropRate: 0,
      duplicateRate: 0,
      failWithRemaining: 0,
    })),
  };
}
