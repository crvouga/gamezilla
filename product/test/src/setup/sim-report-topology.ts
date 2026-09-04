/**
 * Topology helpers for DST report capture.
 */

import type { Sim } from '@product/console/sim/create-sim';

export function simReportTopology(sim: Sim) {
  const clientIds = sim.clientIds();
  const nodes = [
    { id: 'server', kind: 'server' },
    { id: 'events', kind: 'events' },
    ...clientIds.map((id) => ({ id, kind: 'client' })),
  ];
  const edges: {
    readonly from: string;
    readonly to: string;
    readonly kind: string;
  }[] = clientIds.map((id) => ({
    from: id,
    to: 'server',
    kind: 'server',
  }));
  edges.push({ from: 'server', to: 'events', kind: 'events' });
  return { nodes, edges };
}
