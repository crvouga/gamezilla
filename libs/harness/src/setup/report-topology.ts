/**
 * Topology snapshot for harness reports: nodes, edges, and live partitions.
 *
 * Mirrors the live fabric: clients address the load balancer, which fans out
 * across the API instances, and each instance talks to pubsub.
 */

import type { ProductHarness } from '../system/harness';

export type HarnessReportTopology = {
  readonly nodes: readonly { readonly id: string; readonly kind: string }[];
  readonly edges: readonly {
    readonly from: string;
    readonly to: string;
    readonly kind: string;
    readonly partitioned: boolean;
  }[];
};

export function harnessReportTopology(
  s: ProductHarness
): HarnessReportTopology {
  const clientIds = s.harness.clientIds();
  const serverIds = s.harness.serverIds();
  const lbId = s.harness.loadBalancer.id;
  const partitions = new Set(
    s.session.network.partitions().map(([a, b]) => `${a}|${b}`)
  );
  const cut = (a: string, b: string) =>
    partitions.has(`${a}|${b}`) || partitions.has(`${b}|${a}`);
  return {
    nodes: [
      { id: lbId, kind: 'lb' },
      ...serverIds.map((id) => ({ id, kind: 'server' })),
      { id: 'events', kind: 'events' },
      ...clientIds.map((id) => ({ id, kind: 'client' })),
    ],
    edges: [
      ...clientIds.map((id) => ({
        from: id,
        to: lbId,
        kind: 'lb',
        partitioned: cut(id, lbId),
      })),
      ...serverIds.map((id) => ({
        from: lbId,
        to: id,
        kind: 'server',
        partitioned: cut(lbId, id),
      })),
      ...serverIds.map((id) => ({
        from: id,
        to: 'events',
        kind: 'events',
        partitioned: cut(id, 'events'),
      })),
    ],
  };
}
