/**
 * Dump sim sqlite + checkpoint metadata for report frames.
 */

import type { SimulationFrameCheckpoint } from '@pkgs/system-console';
import type { Sim } from '../../sim/create-sim';

export type SimSnapshotDatabase = {
  readonly nodeId: string;
  readonly bytes: Uint8Array;
};

export async function snapshotSimDatabases(
  sim: Sim
): Promise<readonly SimSnapshotDatabase[]> {
  const nodes: SimSnapshotDatabase[] = [
    { nodeId: 'server', bytes: await sim.serverSql.exportBytes() },
  ];
  for (const id of sim.clientIds()) {
    const handle = sim.clientSql(id);
    if (handle === undefined) continue;
    nodes.push({ nodeId: id, bytes: await handle.exportBytes() });
  }
  return nodes;
}

export function snapshotSimCheckpoint(
  sim: Sim,
  clockMs: number
): Omit<SimulationFrameCheckpoint, 'file'> {
  return {
    clockMs,
    clockPaused: false,
    clientIds: [...sim.clientIds()],
    roomTopics: [...sim.roomNode.listTopics()],
    partitions: [],
    skewByAddress: {},
    downAddresses: [],
    evictedAddresses: [],
  };
}

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
