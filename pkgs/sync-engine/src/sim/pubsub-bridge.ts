import type { PubSub } from '@pkgs/pubsub/interface';
import { type Topic } from '@pkgs/pubsub/topic';

import type { SimEndpointId, SimNetwork } from './network';
import { createPeerPubSub, type PubSubPeer } from './pubsub-peer';

type PubWire = {
  readonly kind: 'pubsub';
  readonly topic: Topic;
  readonly data: unknown;
  readonly source: SimEndpointId;
};

type DeliverWire = {
  readonly kind: 'pubsub-deliver';
  readonly topic: Topic;
  readonly data: unknown;
};

function isPubWire(value: unknown): value is PubWire {
  if (value === null || typeof value !== 'object') return false;
  const r = value as Record<string, unknown>;
  return r['kind'] === 'pubsub' && typeof r['topic'] === 'string';
}

/**
 * PubSub instances that deliver through {@link SimNetwork} (lossy, delayed).
 * Use distinct endpoint ids from HTTP clients (e.g. `pubsub:alice`).
 */
export type SimPubSubBroker = {
  readonly createPubSub: (clientEndpointId: SimEndpointId) => PubSub;
  readonly dispose: () => void;
};

export function createSimPubSubBroker(args: {
  readonly network: SimNetwork;
  readonly brokerId: SimEndpointId;
}): SimPubSubBroker {
  const peers = new Map<SimEndpointId, PubSubPeer>();

  args.network.register(args.brokerId, (payload) => {
    if (!isPubWire(payload)) return;
    for (const peer of peers.values()) {
      if (peer.closed) continue;
      if (peer.endpointId === payload.source) continue;
      if (!peer.handlers.has(payload.topic)) continue;
      args.network.send(args.brokerId, peer.endpointId, {
        kind: 'pubsub-deliver',
        topic: payload.topic,
        data: payload.data,
      } satisfies DeliverWire);
    }
  });

  return {
    createPubSub: (clientEndpointId) =>
      createPeerPubSub({
        network: args.network,
        brokerId: args.brokerId,
        clientEndpointId,
        peers,
      }),
    dispose() {
      for (const peer of [...peers.values()]) {
        peer.closed = true;
        args.network.unregister(peer.endpointId);
      }
      peers.clear();
      args.network.unregister(args.brokerId);
    },
  };
}
