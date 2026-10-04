/**
 * Topology stimuli for the API fleet behind the load balancer.
 *
 * They make the fleet size part of a scenario's state: a run can scale out,
 * cut a client off at the balancer, or retire an instance mid-flight, and the
 * product must keep converging either way.
 */

import { defineAction } from '@pkgs/harness-shared/define-action';
import type { ProductHarness } from './harness';
import { caps, clientIds, serverIds } from './observations';

/** Scale out: boot another stateless API instance into the rotation. */
export const spawnServerNode = defineAction({
  name: 'spawnServerNode',
  act: async (s: ProductHarness) => {
    await s.harness.spawnServer();
  },
});

/** Scale in: retire an instance. Never the last one — that is `crash`. */
export const dropServerNode = defineAction({
  name: 'dropServerNode',
  enabled: (s: ProductHarness) => serverIds(s).length > 1,
  act: async (s: ProductHarness, id: string) => {
    if (id === '' || s.harness.serverIds().length <= 1) return;
    await s.harness.dropServer(id);
  },
});

/**
 * Cut one client off at the ingress. Unlike `partition` (client ↛ one
 * instance), this isolates the client from the whole fleet however many
 * instances are live.
 */
export const partitionLoadBalancer = defineAction({
  name: 'partitionLoadBalancer',
  enabled: (s: ProductHarness) =>
    caps(s).includes('partition') && clientIds(s).length > 0,
  act: (s: ProductHarness, id: string) => {
    if (id === '') return;
    s.session.network.partition(s.harness.loadBalancer.id, id);
  },
});

export const productServerActions = [
  spawnServerNode,
  dropServerNode,
  partitionLoadBalancer,
] as const;
