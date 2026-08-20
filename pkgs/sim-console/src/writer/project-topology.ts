import type { SimulationReportTopology } from '../types';

const CLIENT_ATTRS = ['html', 'sqlite', 'ingress', 'egress'] as const;
const SERVER_ATTRS = ['sqlite', 'ingress', 'egress'] as const;
const DEFAULT_ATTRS = ['ingress', 'egress'] as const;

export type SimTopologyNode = {
  readonly id: string;
  readonly kind: string;
  readonly down?: boolean;
};

export type SimTopologyEdge = {
  readonly from: string;
  readonly to: string;
  readonly kind: string;
  readonly partitioned?: boolean;
};

export type SimTopology = {
  readonly nodes: readonly SimTopologyNode[];
  readonly edges: readonly SimTopologyEdge[];
};

function attributesFor(kind: string): readonly string[] {
  if (kind === 'client') return CLIENT_ATTRS;
  if (kind === 'server' || kind === 'db') return SERVER_ATTRS;
  return DEFAULT_ATTRS;
}

/**
 * Map the explicit sim client/server/room graph into persisted topology.json.
 */
export function projectReportTopology(
  topology: SimTopology,
  seed: string
): SimulationReportTopology {
  const kinds = new Map<string, readonly string[]>();
  for (const n of topology.nodes) {
    if (!kinds.has(n.kind)) kinds.set(n.kind, attributesFor(n.kind));
  }

  const nodes = topology.nodes.map((n) => ({
    id: n.id,
    kind: n.kind,
    status: n.down === true ? 'down' : 'ok',
    attributes: [...attributesFor(n.kind)],
    clockSkewMs: 0,
  }));

  const spawn = Object.fromEntries(
    [...kinds.keys()].map((kind) => {
      if (kind === 'client') {
        return [kind, { edges: [{ to: 'server', kind: 'server' }] }];
      }
      if (kind === 'server') {
        return [kind, { edges: [{ to: 'events', kind: 'events' }] }];
      }
      return [kind, { edges: [] }];
    })
  );

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
      spawn,
    },
    nodes,
    edges: topology.edges.map((e) => ({
      from: e.from,
      to: e.to,
      kind: e.kind,
      state: e.partitioned === true ? 'down' : 'up',
      latencyMs: 0,
      jitterMs: 0,
      dropRate: 0,
      duplicateRate: 0,
      failWithRemaining: 0,
    })),
  };
}
