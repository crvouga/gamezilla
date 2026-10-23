/** Shared-DB server nodes behind the simulated HTTP ingress. */

import { createMonotonicCheckpoint } from '@pkgs/sync-engine-shared-ts/commit-checkpoint';
import type { HarnessServer, OpenHarnessServerArgs } from './server';
import { openHarnessServer } from './server';
import { serverNodeEndpoint } from './traffic';

export const DEFAULT_HARNESS_SERVER_NODE_IDS = ['a', 'b'] as const;

export type HarnessServerNode = {
  readonly endpointId: string;
  readonly server: HarnessServer;
};

export type OpenHarnessServerClusterArgs = OpenHarnessServerArgs & {
  readonly nodeIds?: readonly string[];
};

export async function openHarnessServerCluster(
  args: OpenHarnessServerClusterArgs
): Promise<readonly HarnessServerNode[]> {
  const nodeIds = args.nodeIds ?? DEFAULT_HARNESS_SERVER_NODE_IDS;
  if (nodeIds.length === 0) throw new Error('harness server cluster: no nodes');
  const checkpoint =
    args.checkpoint ??
    createMonotonicCheckpoint(
      args.now,
      args.checkpointFloor !== undefined
        ? { initialLast: args.checkpointFloor }
        : undefined
    );
  const primary = await openHarnessServer({ ...args, checkpoint });
  const nodes: HarnessServerNode[] = [
    { endpointId: serverNodeEndpoint(nodeIds[0]!), server: primary },
  ];
  for (const nodeId of nodeIds.slice(1)) {
    const server = await openHarnessServer({
      ...args,
      checkpoint,
      existingDb: primary.db,
      onDisposeDb: () => Promise.resolve(),
    });
    nodes.push({ endpointId: serverNodeEndpoint(nodeId), server });
  }
  return nodes;
}
