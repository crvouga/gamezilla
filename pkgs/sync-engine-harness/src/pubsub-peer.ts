import type { EndpointId } from '@pkgs/harness-root-shared/network-state';
import type { PubSub, PubSubStatus } from '@pkgs/pubsub-root-shared/interface';
import { PubSubClosedError } from '@pkgs/pubsub-root-shared/pubsub-closed-error';
import type { Topic } from '@pkgs/pubsub-root-shared/topic';
import { assertValidTopic } from '@pkgs/pubsub-root-shared/topic';
import type { SyncNetwork } from './network';

export type PeerHandler = (data: unknown) => void;

export type PubSubPeer = {
  readonly endpointId: EndpointId;
  readonly handlers: Map<Topic, Set<PeerHandler>>;
  /** Topics this instance subscribed to (kept after unsubscribe-before-close). */
  readonly interestedTopics: Set<Topic>;
  status: PubSubStatus;
  readonly statusListeners: Set<(s: PubSubStatus) => void>;
  closed: boolean;
};

type DeliverWire = {
  readonly kind: 'pubsub-deliver';
  readonly topic: Topic;
  readonly data: unknown;
};

type PubWire = {
  readonly kind: 'pubsub';
  readonly topic: Topic;
  readonly data: unknown;
  readonly source: EndpointId;
};

function isDeliverWire(value: unknown): value is DeliverWire {
  if (value === null || typeof value !== 'object') return false;
  const r = value as Record<string, unknown>;
  return r['kind'] === 'pubsub-deliver' && typeof r['topic'] === 'string';
}

export type CreatePeerPubSubArgs = {
  readonly network: SyncNetwork;
  readonly brokerId: EndpointId;
  readonly clientEndpointId: EndpointId;
  readonly peers: Map<EndpointId, PubSubPeer>;
  /** Snapshot subscribed topics before close (for optional offline buffer). */
  readonly onClose?: (topics: readonly Topic[]) => void;
  /** After a handler is registered — flush buffered delivers for this topic. */
  readonly onSubscribe?: (topic: Topic) => void;
};

/** One peer PubSub instance registered on the harness network. */
export function createPeerPubSub(args: CreatePeerPubSubArgs): PubSub {
  const interestedTopics = new Set<Topic>();
  const peer: PubSubPeer = {
    endpointId: args.clientEndpointId,
    handlers: new Map(),
    interestedTopics,
    status: 'connected',
    statusListeners: new Set(),
    closed: false,
  };
  args.peers.set(args.clientEndpointId, peer);

  args.network.register(args.clientEndpointId, (payload) => {
    if (!isDeliverWire(payload)) return;
    const set = peer.handlers.get(payload.topic);
    if (set === undefined) return;
    for (const h of [...set]) h(payload.data);
  });

  const assertOpen = (): void => {
    if (peer.closed) throw new PubSubClosedError();
  };

  return {
    async publish(topic, data) {
      assertOpen();
      assertValidTopic(topic);
      args.network.send(args.clientEndpointId, args.brokerId, {
        kind: 'pubsub',
        topic,
        data,
        source: args.clientEndpointId,
      } satisfies PubWire);
    },
    subscribe(topic, handler) {
      assertOpen();
      assertValidTopic(topic);
      interestedTopics.add(topic);
      let set = peer.handlers.get(topic);
      if (set === undefined) {
        set = new Set();
        peer.handlers.set(topic, set);
      }
      set.add(handler);
      args.onSubscribe?.(topic);
      return () => {
        set!.delete(handler);
        if (set!.size === 0) peer.handlers.delete(topic);
      };
    },
    status: () => peer.status,
    onStatus(listener) {
      peer.statusListeners.add(listener);
      return () => {
        peer.statusListeners.delete(listener);
      };
    },
    close() {
      if (peer.closed) return;
      const topics = [...interestedTopics];
      interestedTopics.clear();
      peer.closed = true;
      peer.handlers.clear();
      args.peers.delete(args.clientEndpointId);
      args.network.unregister(args.clientEndpointId);
      peer.status = 'down';
      for (const l of [...peer.statusListeners]) l('down');
      peer.statusListeners.clear();
      args.onClose?.(topics);
    },
  };
}
