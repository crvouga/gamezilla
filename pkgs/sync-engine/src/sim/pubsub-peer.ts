import type { PubSub, PubSubStatus } from '@pkgs/pubsub/interface';
import { PubSubClosedError } from '@pkgs/pubsub/pubsub-closed-error';
import { assertValidTopic, type Topic } from '@pkgs/pubsub/topic';

import type { SimEndpointId, SimNetwork } from './network';

export type PeerHandler = (data: unknown) => void;

export type PubSubPeer = {
  readonly endpointId: SimEndpointId;
  readonly handlers: Map<Topic, Set<PeerHandler>>;
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
  readonly source: SimEndpointId;
};

function isDeliverWire(value: unknown): value is DeliverWire {
  if (value === null || typeof value !== 'object') return false;
  const r = value as Record<string, unknown>;
  return r['kind'] === 'pubsub-deliver' && typeof r['topic'] === 'string';
}

export type CreatePeerPubSubArgs = {
  readonly network: SimNetwork;
  readonly brokerId: SimEndpointId;
  readonly clientEndpointId: SimEndpointId;
  readonly peers: Map<SimEndpointId, PubSubPeer>;
};

/** One peer PubSub instance registered on the sim network. */
export function createPeerPubSub(args: CreatePeerPubSubArgs): PubSub {
  const peer: PubSubPeer = {
    endpointId: args.clientEndpointId,
    handlers: new Map(),
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
      let set = peer.handlers.get(topic);
      if (set === undefined) {
        set = new Set();
        peer.handlers.set(topic, set);
      }
      set.add(handler);
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
      peer.closed = true;
      peer.handlers.clear();
      args.peers.delete(args.clientEndpointId);
      args.network.unregister(args.clientEndpointId);
      peer.status = 'down';
      for (const l of [...peer.statusListeners]) l('down');
      peer.statusListeners.clear();
    },
  };
}
