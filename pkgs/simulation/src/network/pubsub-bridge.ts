import type { EventLog } from '../events';
import type { SimMesh } from './create-sim-mesh';

export type SimPubSubPeer = {
  readonly nodeId: string;
  readonly receive: (
    topic: string,
    data: unknown,
    meta: PubSubDeliverMeta
  ) => void;
  readonly isSilentDropped?: () => boolean;
};

export type PubSubDeliverMeta = {
  readonly redelivery?: boolean;
};

export type SimPubSubBus = {
  register(peer: SimPubSubPeer): void;
  unregister(nodeId: string): void;
  publish(args: {
    readonly from: string;
    readonly topic: string;
    readonly data: unknown;
  }): Promise<void>;
  /** Broker: drop subscription silently for a peer (client still "connected"). */
  silentDrop(nodeId: string): void;
  clearSilentDrop(nodeId: string): void;
  isSilentDropped(nodeId: string): boolean;
  /** Retain recent messages for at-least-once redeliver after broker restart. */
  retain(topic: string, data: unknown): void;
  redeliver(toNodeId: string): Promise<void>;
  recent(): readonly { readonly topic: string; readonly data: unknown }[];
};

export type CreateSimPubSubBusArgs = {
  readonly brokerId: string;
  readonly mesh: SimMesh;
  readonly events: EventLog;
  readonly retainLimit?: number;
};

type PubSubRuntime = {
  readonly args: CreateSimPubSubBusArgs;
  readonly peers: Map<string, SimPubSubPeer>;
  readonly silent: Set<string>;
  readonly retained: { topic: string; data: unknown }[];
};

/** Mesh-aware pubsub fanout: emit → broker → per-subscriber receive. */
export function createSimPubSubBus(args: CreateSimPubSubBusArgs): SimPubSubBus {
  const runtime: PubSubRuntime = {
    args,
    peers: new Map(),
    silent: new Set(),
    retained: [],
  };
  const retainLimit = args.retainLimit ?? 64;

  return {
    register(peer) {
      runtime.peers.set(peer.nodeId, peer);
    },
    unregister(nodeId) {
      runtime.peers.delete(nodeId);
      runtime.silent.delete(nodeId);
    },
    silentDrop(nodeId) {
      runtime.silent.add(nodeId);
      args.events.append({
        kind: 'broker.subscriptionDrop',
        nodeId: args.brokerId,
        to: nodeId,
      });
    },
    clearSilentDrop(nodeId) {
      runtime.silent.delete(nodeId);
    },
    isSilentDropped: (nodeId) => runtime.silent.has(nodeId),
    retain(topic, data) {
      runtime.retained.push({ topic, data });
      while (runtime.retained.length > retainLimit) runtime.retained.shift();
    },
    recent: () => [...runtime.retained],
    redeliver: (toNodeId) => redeliverTo(runtime, toNodeId),
    publish: (pub) => publishThroughMesh(runtime, pub),
  };
}

async function publishThroughMesh(
  runtime: PubSubRuntime,
  pub: { readonly from: string; readonly topic: string; readonly data: unknown }
): Promise<void> {
  const { args, peers, silent, retained } = runtime;
  args.events.append({
    kind: 'pubsub.emit',
    from: pub.from,
    to: args.brokerId,
    nodeId: pub.from,
    detail: pub.topic,
    meta: { topic: pub.topic },
  });
  retained.push({ topic: pub.topic, data: pub.data });
  while (retained.length > (args.retainLimit ?? 64)) retained.shift();

  const toBroker = await args.mesh.send({
    from: pub.from,
    to: args.brokerId,
    kind: 'pubsub',
    hop: 'forward',
    meta: { topic: pub.topic },
    deliver: () => undefined,
  });
  if (toBroker !== 'delivered') return;

  for (const peer of peers.values()) {
    if (peer.nodeId === pub.from) continue;
    if (silent.has(peer.nodeId)) continue;
    await deliverToPeer({ runtime, peer, topic: pub.topic, data: pub.data });
  }
}

async function deliverToPeer(ctx: {
  readonly runtime: PubSubRuntime;
  readonly peer: SimPubSubPeer;
  readonly topic: string;
  readonly data: unknown;
  readonly redelivery?: boolean;
}): Promise<void> {
  const { runtime, peer, topic, data } = ctx;
  const redelivery = ctx.redelivery === true;
  const { args } = runtime;
  const result = await args.mesh.send({
    from: args.brokerId,
    to: peer.nodeId,
    kind: 'pubsub',
    hop: 'forward',
    meta: { topic, redelivery },
    deliver: () => {
      peer.receive(topic, data, { redelivery });
      args.events.append({
        kind: redelivery ? 'pubsub.redeliver' : 'pubsub.receive',
        from: args.brokerId,
        to: peer.nodeId,
        nodeId: peer.nodeId,
        detail: topic,
        meta: { topic, redelivery },
      });
    },
  });
  if (result === 'dropped' || result === 'partitioned') {
    args.events.append({
      kind: 'pubsub.receive',
      from: args.brokerId,
      to: peer.nodeId,
      nodeId: peer.nodeId,
      status: result === 'dropped' ? 'dropped' : 'error',
      detail: topic,
      meta: { topic, result },
    });
  }
}

async function redeliverTo(
  runtime: PubSubRuntime,
  toNodeId: string
): Promise<void> {
  const peer = runtime.peers.get(toNodeId);
  if (!peer || runtime.silent.has(toNodeId)) return;
  for (const msg of runtime.retained) {
    await deliverToPeer({
      runtime,
      peer,
      topic: msg.topic,
      data: msg.data,
      redelivery: true,
    });
  }
}
