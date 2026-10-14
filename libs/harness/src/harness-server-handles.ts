import type { Harness } from './create-harness';
import type { HarnessNet } from './net';
import type { HarnessServerNode, HarnessServerNodes } from './server-nodes';
import { HARNESS_PRIMARY_SERVER_ID } from './server-nodes';

function primaryServer(servers: HarnessServerNodes): HarnessServerNode {
  const node = servers.get(HARNESS_PRIMARY_SERVER_ID);
  if (node === undefined) throw new Error('primary server is missing');
  return node;
}

/** The API instances: spawn, drop and read them, and the primary's ports. */
export function serverHandles(
  servers: HarnessServerNodes,
  net: Pick<HarnessNet, 'restart'>
): Pick<
  Harness,
  | 'spawnServer'
  | 'dropServer'
  | 'serverIds'
  | 'serverEnv'
  | 'drainServerFetch'
  | 'outboxConsumers'
  | 'authorizeServerMutation'
> {
  return {
    async spawnServer(id) {
      const node = await servers.spawn(id);
      // A respawned instance must not stay marked down from a prior crash.
      net.restart(node.id);
      return node.app;
    },
    dropServer: (id) => servers.drop(id),
    serverIds: () => servers.ids(),
    serverEnv: (id) => servers.get(id)?.env,
    drainServerFetch: () => servers.drainAll(),
    outboxConsumers: () => primaryServer(servers).outboxConsumers,
    authorizeServerMutation: () => primaryServer(servers).authorizeMutation,
  };
}
