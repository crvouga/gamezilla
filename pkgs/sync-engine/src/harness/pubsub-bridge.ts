import type { PubSub } from '@pkgs/pubsub/interface';
import type { Topic } from '@pkgs/pubsub/topic';
import { corruptUnknownPayload } from './corruption-faults';
import type { EdgeFaultController } from './edge-faults';
import type { EndpointId, SyncNetwork } from './network';
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
  readonly source: EndpointId;
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
 * PubSub instances that deliver through {@link SyncNetwork} (lossy, delayed).
 * Use distinct endpoint ids from HTTP clients (e.g. `pubsub:alice`).
 */
export type HarnessPubSubBroker = {
  readonly createPubSub: (clientEndpointId: EndpointId) => PubSub;
  /** Topics with active handlers for a peer (empty if closed / unknown). */
  readonly subscribedTopics: (clientEndpointId: EndpointId) => readonly Topic[];
  readonly dispose: () => void;
};

export type CreateHarnessPubSubBrokerArgs = {
  readonly network: SyncNetwork;
  readonly brokerId: EndpointId;
  readonly faults?: EdgeFaultController;
  readonly rng?: SeededRng;
  /**
   * When true, buffer publishes for a peer's last topics while closed and
   * flush on re-subscribe. Default false = QoS-0 drop on reconnect.
   */
  readonly liveResendOnReconnect?: boolean;
};

function deliverTo(args: {
  readonly network: SyncNetwork;
  readonly brokerId: EndpointId;
  readonly endpointId: EndpointId;
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
  readonly faults?: EdgeFaultController;
  readonly rng?: SeededRng;
  readonly topic: Topic;
  readonly data: unknown;
}): unknown | null {
  if (args.faults?.shouldDropTopic(args.topic)) return null;
  const corruption = args.faults?.takePubsubCorruption(args.topic);
  if (corruption !== undefined && args.rng !== undefined) {
    return corruptUnknownPayload(args.data, corruption, args.rng);
  }
  return args.data;
}

function fanoutPublish(args: {
  readonly peers: Map<EndpointId, PubSubPeer>;
  readonly buffers: OfflineBuffers;
  readonly network: SyncNetwork;
  readonly brokerId: EndpointId;
  readonly faults?: EdgeFaultController;
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
  readonly network: SyncNetwork;
  readonly brokerId: EndpointId;
  readonly clientEndpointId: EndpointId;
  readonly peers: Map<EndpointId, PubSubPeer>;
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

export function createHarnessPubSubBroker(
  args: CreateHarnessPubSubBrokerArgs
): HarnessPubSubBroker {
  const peers = new Map<EndpointId, PubSubPeer>();
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
