import type { PubSub } from '@pkgs/pubsub/interface';
import type { Topic } from '@pkgs/pubsub/topic';

import type { SimEndpointId, SimNetwork } from './network';
import {
  createOfflineBuffers,
  type OfflineBuffers,
} from './pubsub-bridge-resend';
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

export type CreateSimPubSubBrokerArgs = {
  readonly network: SimNetwork;
  readonly brokerId: SimEndpointId;
  /**
   * When true, buffer publishes for a peer's last topics while closed and
   * flush on re-subscribe. Default false = QoS-0 drop on reconnect.
   */
  readonly liveResendOnReconnect?: boolean;
};

function deliverTo(args: {
  readonly network: SimNetwork;
  readonly brokerId: SimEndpointId;
  readonly endpointId: SimEndpointId;
  readonly topic: Topic;
  readonly data: unknown;
}): void {
  args.network.send(args.brokerId, args.endpointId, {
    kind: 'pubsub-deliver',
    topic: args.topic,
    data: args.data,
  } satisfies DeliverWire);
}

function fanoutPublish(args: {
  readonly peers: Map<SimEndpointId, PubSubPeer>;
  readonly buffers: OfflineBuffers;
  readonly network: SimNetwork;
  readonly brokerId: SimEndpointId;
  readonly wire: PubWire;
}): void {
  const { peers, buffers, network, brokerId, wire } = args;
  for (const peer of peers.values()) {
    if (peer.closed || peer.endpointId === wire.source) continue;
    if (peer.handlers.has(wire.topic)) {
      deliverTo({
        network,
        brokerId,
        endpointId: peer.endpointId,
        topic: wire.topic,
        data: wire.data,
      });
      continue;
    }
    buffers.bufferSoftOffline(peer, wire.topic, wire.data);
  }
  buffers.bufferHardOffline(wire.source, peers, wire.topic, wire.data);
}

/** Build one peer with optional offline snapshot / flush hooks. */
function createBrokerPeer(args: {
  readonly network: SimNetwork;
  readonly brokerId: SimEndpointId;
  readonly clientEndpointId: SimEndpointId;
  readonly peers: Map<SimEndpointId, PubSubPeer>;
  readonly buffers: OfflineBuffers;
}): PubSub {
  const { clientEndpointId, buffers } = args;
  return createPeerPubSub({
    network: args.network,
    brokerId: args.brokerId,
    clientEndpointId,
    peers: args.peers,
    onClose: (topics) => {
      buffers.onPeerClose(clientEndpointId, topics);
    },
    onSubscribe: (topic) => {
      buffers.flushOnSubscribe(clientEndpointId, topic, (t, data) => {
        deliverTo({
          network: args.network,
          brokerId: args.brokerId,
          endpointId: clientEndpointId,
          topic: t,
          data,
        });
      });
    },
  });
}

export function createSimPubSubBroker(
  args: CreateSimPubSubBrokerArgs
): SimPubSubBroker {
  const peers = new Map<SimEndpointId, PubSubPeer>();
  const buffers = createOfflineBuffers(args.liveResendOnReconnect === true);

  args.network.register(args.brokerId, (payload) => {
    if (!isPubWire(payload)) return;
    fanoutPublish({
      peers,
      buffers,
      network: args.network,
      brokerId: args.brokerId,
      wire: payload,
    });
  });

  return {
    createPubSub: (clientEndpointId) =>
      createBrokerPeer({
        network: args.network,
        brokerId: args.brokerId,
        clientEndpointId,
        peers,
        buffers,
      }),
    dispose() {
      for (const peer of [...peers.values()]) {
        peer.closed = true;
        args.network.unregister(peer.endpointId);
      }
      peers.clear();
      buffers.clear();
      args.network.unregister(args.brokerId);
    },
  };
}
