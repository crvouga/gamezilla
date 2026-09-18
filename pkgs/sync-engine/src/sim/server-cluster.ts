/** Shared-DB server nodes behind the simulated HTTP ingress. */

import { createMonotonicCheckpoint } from '../shared/commit-checkpoint';
import {
  type OpenSimServerArgs,
  openSimServer,
  type SimServer,
} from './server';
import { serverNodeEndpoint } from './traffic';

export const DEFAULT_SIM_SERVER_NODE_IDS = ['a', 'b'] as const;

export type SimServerNode = {
  readonly endpointId: string;
  readonly server: SimServer;
};

export type OpenSimServerClusterArgs = OpenSimServerArgs & {
  readonly nodeIds?: readonly string[];
};

export async function openSimServerCluster(
  args: OpenSimServerClusterArgs
): Promise<readonly SimServerNode[]> {
  const nodeIds = args.nodeIds ?? DEFAULT_SIM_SERVER_NODE_IDS;
  if (nodeIds.length === 0) throw new Error('sim server cluster: no nodes');
  const checkpoint =
    args.checkpoint ??
    createMonotonicCheckpoint(
      args.now,
      args.checkpointFloor !== undefined
        ? { initialLast: args.checkpointFloor }
        : undefined
    );
  const primary = await openSimServer({ ...args, checkpoint });
  const nodes: SimServerNode[] = [
    { endpointId: serverNodeEndpoint(nodeIds[0]!), server: primary },
  ];
  for (const nodeId of nodeIds.slice(1)) {
    const server = await openSimServer({
      ...args,
      checkpoint,
      existingDb: primary.db,
      onDisposeDb: () => Promise.resolve(),
    });
    nodes.push({ endpointId: serverNodeEndpoint(nodeId), server });
  }
  return nodes;
}
