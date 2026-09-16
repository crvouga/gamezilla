/**
 * Topology helpers for DST report capture.
 *
 * Mirrors the live fabric: clients address the load balancer, which fans out
 * across the API instances, and each instance talks to pubsub.
 */

import type { Sim } from '@apps/product/sim/fabric/create-sim';

export function simReportTopology(sim: Sim) {
  const clientIds = sim.clientIds();
  const serverIds = sim.serverIds();
  const lbId = sim.loadBalancer.id;
  const nodes = [
    { id: lbId, kind: 'lb' },
    ...serverIds.map((id) => ({ id, kind: 'server' })),
    { id: 'events', kind: 'events' },
    ...clientIds.map((id) => ({ id, kind: 'client' })),
  ];
  const edges: {
    readonly from: string;
    readonly to: string;
    readonly kind: string;
  }[] = [
    ...clientIds.map((id) => ({ from: id, to: lbId, kind: 'lb' })),
    ...serverIds.map((id) => ({ from: lbId, to: id, kind: 'server' })),
    ...serverIds.map((id) => ({ from: id, to: 'events', kind: 'events' })),
  ];
  return { nodes, edges };
}
