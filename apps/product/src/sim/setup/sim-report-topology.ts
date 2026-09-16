/**
 * Topology snapshot for sim reports: nodes, edges, and live partitions.
 */

import type { ProductSim } from '../system/sim';

export type SimReportTopology = {
  readonly nodes: readonly { readonly id: string; readonly kind: string }[];
  readonly edges: readonly {
    readonly from: string;
    readonly to: string;
    readonly kind: string;
    readonly partitioned: boolean;
  }[];
};

export function simReportTopology(s: ProductSim): SimReportTopology {
  const clientIds = s.sim.clientIds();
  const partitions = new Set(
    s.session.network.partitions().map(([a, b]) => `${a}|${b}`)
  );
  const cut = (a: string, b: string) =>
    partitions.has(`${a}|${b}`) || partitions.has(`${b}|${a}`);
  return {
    nodes: [
      { id: 'server', kind: 'server' },
      { id: 'events', kind: 'events' },
      ...clientIds.map((id) => ({ id, kind: 'client' })),
    ],
    edges: [
      ...clientIds.map((id) => ({
        from: id,
        to: 'server',
        kind: 'server',
        partitioned: cut(id, 'server'),
      })),
      { from: 'server', to: 'events', kind: 'events', partitioned: false },
    ],
  };
}
