/**
 * Topology stimuli for the API fleet behind the load balancer.
 *
 * They make the fleet size part of a scenario's state: a run can scale out,
 * cut a client off at the balancer, or retire an instance mid-flight, and the
 * product must keep converging either way.
 */

import { defineAction } from '@pkgs/sim';

import { caps, clientIds, serverIds } from './observations';
import type { ProductSim } from './sim';

/** Scale out: boot another stateless API instance into the rotation. */
export const spawnServerNode = defineAction({
  name: 'spawnServerNode',
  act: async (s: ProductSim) => {
    await s.sim.spawnServer();
  },
});

/** Scale in: retire an instance. Never the last one — that is `crash`. */
export const dropServerNode = defineAction({
  name: 'dropServerNode',
  enabled: (s: ProductSim) => serverIds(s).length > 1,
  act: async (s: ProductSim, id: string) => {
    if (id === '' || s.sim.serverIds().length <= 1) return;
    await s.sim.dropServer(id);
  },
});

/**
 * Cut one client off at the ingress. Unlike `partition` (client ↛ one
 * instance), this isolates the client from the whole fleet however many
 * instances are live.
 */
export const partitionLoadBalancer = defineAction({
  name: 'partitionLoadBalancer',
  enabled: (s: ProductSim) =>
    caps(s).includes('partition') && clientIds(s).length > 0,
  act: (s: ProductSim, id: string) => {
    if (id === '') return;
    s.session.network.partition(s.sim.loadBalancer.id, id);
  },
});

export const productServerActions = [
  spawnServerNode,
  dropServerNode,
  partitionLoadBalancer,
] as const;
