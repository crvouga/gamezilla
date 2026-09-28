/**
 * Dynamic API-fleet + balancer nodes for the product-harness console.
 *
 * All instances read the same Postgres, so every server node exposes the same
 * `sqlClient`; what differs per instance is its request log and its place in
 * the balancer rotation.
 */

import type { Harness } from '@libs/harness/fabric/create-harness';
import type { HarnessLoadBalancerRoute } from '@libs/harness/fabric/load-balancer';
import {
  createProductHarnessLogBuffer,
  type ProductHarnessLoadBalancerNode,
  type ProductHarnessLogBuffer,
  type ProductHarnessSqlNode,
} from '@pkgs/harness-console/client';

import {
  fireDomainWake,
  notify,
  type SessionMaps,
} from './product-harness-session-teardown';

export function makeProductHarnessLoadBalancerNode(
  harness: Harness,
  logs: ProductHarnessLogBuffer
): ProductHarnessLoadBalancerNode {
  return {
    id: harness.loadBalancer.id,
    address: harness.loadBalancer.id,
    logs,
    inspect: () => harness.loadBalancer.inspect(),
  };
}

function serverLogsFor(maps: SessionMaps, id: string): ProductHarnessLogBuffer {
  const existing = maps.serverLogs.get(id);
  if (existing !== undefined) return existing;
  const logs = createProductHarnessLogBuffer();
  maps.serverLogs.set(id, logs);
  return logs;
}

function makeServerNode(
  harness: Harness,
  maps: SessionMaps,
  id: string
): ProductHarnessSqlNode {
  return {
    id,
    address: id,
    sqlClient: harness.serverSql.sqlClient,
    logs: serverLogsFor(maps, id),
  };
}

function routeEntry(route: HarnessLoadBalancerRoute) {
  const target = route.to ?? 'no healthy backend';
  return {
    at: route.at,
    level: (route.to === null ? 'error' : 'debug') as 'error' | 'debug',
    msg: `${route.method} ${route.path} · ${route.from} → ${target}`,
  };
}

/**
 * Mirror every route decision into the balancer log and the log of whichever
 * instance served it, so "who handled this request" is readable in the UI.
 */
export function bindLoadBalancerRouteLogs(args: {
  readonly harness: Harness;
  readonly maps: SessionMaps;
  readonly balancerLogs: ProductHarnessLogBuffer;
}): () => void {
  return args.harness.loadBalancer.onRoute((route) => {
    const entry = routeEntry(route);
    args.balancerLogs.append(entry);
    if (route.to !== null) serverLogsFor(args.maps, route.to).append(entry);
  });
}

export async function addProductHarnessServer(
  harness: Harness,
  maps: SessionMaps,
  id?: string
): Promise<ProductHarnessSqlNode> {
  const requested = id?.trim();
  if (
    requested !== undefined &&
    requested !== '' &&
    maps.servers.has(requested)
  ) {
    throw new Error(`harness server '${requested}' already exists`);
  }
  await harness.spawnServer(requested === '' ? undefined : requested);
  return refreshProductHarnessServers(harness, maps);
}

export async function removeProductHarnessServer(
  harness: Harness,
  maps: SessionMaps,
  id: string
): Promise<void> {
  if (!maps.servers.has(id)) return;
  if (maps.servers.size <= 1) {
    throw new Error(
      `cannot remove '${id}': the fleet needs one instance — crash it instead`
    );
  }
  await harness.dropServer(id);
  // Clear faults keyed to a retired address so a respawn starts clean.
  harness.heal(id);
  harness.restart(id);
  maps.serverLogs.delete(id);
  refreshProductHarnessServers(harness, maps);
}

/**
 * Rebuild the server node map from the fabric (spawn / drop / snapshot load).
 * Returns the node for the most recently added instance.
 */
export function refreshProductHarnessServers(
  harness: Harness,
  maps: SessionMaps
): ProductHarnessSqlNode {
  const ids = harness.serverIds();
  maps.servers.clear();
  for (const serverId of ids) {
    maps.servers.set(serverId, makeServerNode(harness, maps, serverId));
  }
  notify(maps);
  fireDomainWake(maps, 'topology');
  const last = ids.at(-1);
  const node = last === undefined ? undefined : maps.servers.get(last);
  if (node === undefined) {
    throw new Error('harness server fleet is empty');
  }
  return node;
}
