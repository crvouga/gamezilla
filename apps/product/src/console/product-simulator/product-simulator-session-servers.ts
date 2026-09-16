/**
 * Dynamic API-fleet + balancer nodes for the product-simulator console.
 *
 * All instances read the same Postgres, so every server node exposes the same
 * `sqlClient`; what differs per instance is its request log and its place in
 * the balancer rotation.
 */

import type { Sim } from '@apps/product/sim/fabric/create-sim';
import type { SimLoadBalancerRoute } from '@apps/product/sim/fabric/sim-load-balancer';
import {
  createProductSimulatorLogBuffer,
  type ProductSimulatorLoadBalancerNode,
  type ProductSimulatorLogBuffer,
  type ProductSimulatorSqlNode,
} from '@pkgs/sim-console/client';

import {
  fireDomainWake,
  notify,
  type SessionMaps,
} from './product-simulator-session-teardown';

export function makeProductSimulatorLoadBalancerNode(
  sim: Sim,
  logs: ProductSimulatorLogBuffer
): ProductSimulatorLoadBalancerNode {
  return {
    id: sim.loadBalancer.id,
    address: sim.loadBalancer.id,
    logs,
    inspect: () => sim.loadBalancer.inspect(),
  };
}

function serverLogsFor(
  maps: SessionMaps,
  id: string
): ProductSimulatorLogBuffer {
  const existing = maps.serverLogs.get(id);
  if (existing !== undefined) return existing;
  const logs = createProductSimulatorLogBuffer();
  maps.serverLogs.set(id, logs);
  return logs;
}

function makeServerNode(
  sim: Sim,
  maps: SessionMaps,
  id: string
): ProductSimulatorSqlNode {
  return {
    id,
    address: id,
    sqlClient: sim.serverSql.sqlClient,
    logs: serverLogsFor(maps, id),
  };
}

function routeEntry(route: SimLoadBalancerRoute) {
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
  readonly sim: Sim;
  readonly maps: SessionMaps;
  readonly balancerLogs: ProductSimulatorLogBuffer;
}): () => void {
  return args.sim.loadBalancer.onRoute((route) => {
    const entry = routeEntry(route);
    args.balancerLogs.append(entry);
    if (route.to !== null) serverLogsFor(args.maps, route.to).append(entry);
  });
}

export async function addProductSimulatorServer(
  sim: Sim,
  maps: SessionMaps,
  id?: string
): Promise<ProductSimulatorSqlNode> {
  const requested = id?.trim();
  if (requested !== undefined && requested !== '' && maps.servers.has(requested)) {
    throw new Error(`simulator server '${requested}' already exists`);
  }
  await sim.spawnServer(requested === '' ? undefined : requested);
  return refreshProductSimulatorServers(sim, maps);
}

export async function removeProductSimulatorServer(
  sim: Sim,
  maps: SessionMaps,
  id: string
): Promise<void> {
  if (!maps.servers.has(id)) return;
  if (maps.servers.size <= 1) {
    throw new Error(
      `cannot remove '${id}': the fleet needs one instance — crash it instead`
    );
  }
  await sim.dropServer(id);
  // Clear faults keyed to a retired address so a respawn starts clean.
  sim.heal(id);
  sim.restart(id);
  maps.serverLogs.delete(id);
  refreshProductSimulatorServers(sim, maps);
}

/**
 * Rebuild the server node map from the fabric (spawn / drop / snapshot load).
 * Returns the node for the most recently added instance.
 */
export function refreshProductSimulatorServers(
  sim: Sim,
  maps: SessionMaps
): ProductSimulatorSqlNode {
  const ids = sim.serverIds();
  maps.servers.clear();
  for (const serverId of ids) {
    maps.servers.set(serverId, makeServerNode(sim, maps, serverId));
  }
  notify(maps);
  fireDomainWake(maps, 'topology');
  const last = ids.at(-1);
  const node = last === undefined ? undefined : maps.servers.get(last);
  if (node === undefined) {
    throw new Error('simulator server fleet is empty');
  }
  return node;
}
