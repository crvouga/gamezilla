import type { PubSub } from '@pkgs/pubsub/interface';
import type { Topic } from '@pkgs/pubsub/topic';

import type { BoundaryFaultController } from './boundary-faults';
import { corruptUnknownPayload } from './corruption-faults';
import type { SimEndpointId, SimNetwork } from './network';
import {
  createOfflineBuffers,
  type OfflineBuffers,
} from './pubsub-bridge-resend';
import { createPeerPubSub, type PubSubPeer } from './pubsub-peer';
import type { SeededRng } from './rng';

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
  /** Topics with active handlers for a peer (empty if closed / unknown). */
  readonly subscribedTopics: (
    clientEndpointId: SimEndpointId
  ) => readonly Topic[];
  readonly dispose: () => void;
};

export type CreateSimPubSubBrokerArgs = {
  readonly network: SimNetwork;
  readonly brokerId: SimEndpointId;
  readonly faults?: BoundaryFaultController;
  readonly rng?: SeededRng;
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

function wireDataForDelivery(args: {
  readonly faults?: BoundaryFaultController;
  readonly rng?: SeededRng;
  readonly topic: Topic;
  readonly data: unknown;
}): unknown | null {
  if (args.faults?.shouldDropTopic(args.topic)) return null;
  const corruption = args.faults?.takePubsubCorruption();
  if (corruption !== undefined && args.rng !== undefined) {
    return corruptUnknownPayload(args.data, corruption, args.rng);
  }
  return args.data;
}

function fanoutPublish(args: {
  readonly peers: Map<SimEndpointId, PubSubPeer>;
  readonly buffers: OfflineBuffers;
  readonly network: SimNetwork;
  readonly brokerId: SimEndpointId;
  readonly faults?: BoundaryFaultController;
  readonly rng?: SeededRng;
  readonly wire: PubWire;
}): void {
  const { peers, buffers, network, brokerId, wire, faults, rng } = args;
  const data = wireDataForDelivery({
    ...(faults !== undefined ? { faults } : {}),
    ...(rng !== undefined ? { rng } : {}),
    topic: wire.topic,
    data: wire.data,
  });
  if (data === null) return;
  const dupes = 1 + (faults?.duplicatePublishCount() ?? 0);
  for (const peer of peers.values()) {
    if (peer.closed || peer.endpointId === wire.source) continue;
    if (peer.handlers.has(wire.topic)) {
      for (let i = 0; i < dupes; i += 1) {
        deliverTo({
          network,
          brokerId,
          endpointId: peer.endpointId,
          topic: wire.topic,
          data,
        });
      }
      continue;
    }
    buffers.bufferSoftOffline(peer, wire.topic, data);
  }
  buffers.bufferHardOffline(wire.source, peers, wire.topic, data);
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
      ...(args.faults !== undefined ? { faults: args.faults } : {}),
      ...(args.rng !== undefined ? { rng: args.rng } : {}),
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
    subscribedTopics: (clientEndpointId) => {
      const peer = peers.get(clientEndpointId);
      if (peer === undefined || peer.closed) return [];
      return [...peer.handlers.keys()].sort();
    },
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
