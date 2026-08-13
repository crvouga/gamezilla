import type { SeededRng } from '@pkgs/io';

import type { EventLog } from '../events';
import type { LiveGraph } from '../graph/live-graph';
import type { SimMesh } from '../network';

export type FuzzController = {
  /** Inject one seeded fault if intensity draw hits. */
  tick(): Promise<void>;
  readonly enabled: boolean;
  readonly intensity: number;
};

export function createFuzzController(args: {
  readonly intensity: number;
  readonly rng: SeededRng;
  readonly graph: LiveGraph;
  readonly mesh: SimMesh;
  readonly events: EventLog;
}): FuzzController {
  const enabled = args.intensity > 0;
  return {
    enabled,
    intensity: args.intensity,
    async tick() {
      if (!enabled) return;
      if (!args.rng.bool(args.intensity)) return;
      const edges = args.mesh.listEdges();
      const nodes = args.graph.listNodes().filter((n) => n.status === 'ok');
      const pick = args.rng.int(3);
      if (pick === 0 && edges.length > 0) {
        const edge = args.rng.pick(edges);
        args.events.append({
          kind: 'fuzz.inject',
          from: edge.from,
          to: edge.to,
          detail: 'hold',
        });
        args.mesh.hold(edge.from, edge.to);
        return;
      }
      if (pick === 1 && edges.length > 0) {
        const edge = args.rng.pick(edges);
        args.events.append({
          kind: 'fuzz.inject',
          from: edge.from,
          to: edge.to,
          detail: 'drop',
        });
        args.mesh.drop(edge.from, edge.to, Math.min(1, args.intensity));
        return;
      }
      if (nodes.length > 0) {
        const node = args.rng.pick(nodes);
        args.events.append({
          kind: 'fuzz.inject',
          nodeId: node.id,
          detail: 'pause',
        });
        args.graph.node(node.id).pause();
      }
    },
  };
}
