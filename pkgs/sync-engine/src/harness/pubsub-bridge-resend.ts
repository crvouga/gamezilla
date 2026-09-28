import type { Topic } from '@pkgs/pubsub/topic';

import type { EndpointId } from './network';
import type { PubSubPeer } from './pubsub-peer';

/** Cap buffered offline delivers per endpoint (Tiger bound). */
const MAX_RESEND_BUFFER = 256;

type OfflineBuffer = {
  /** Topics the peer held when it disconnected / detached. */
  readonly topics: Set<Topic>;
  /** Missed publishes for those topics, oldest first. */
  messages: Array<{ readonly topic: Topic; readonly data: unknown }>;
};

function appendBuffered(
  entry: OfflineBuffer,
  topic: Topic,
  data: unknown
): void {
  entry.messages.push({ topic, data });
  while (entry.messages.length > MAX_RESEND_BUFFER) {
    entry.messages.shift();
  }
}

export type OfflineBuffers = {
  readonly bufferSoftOffline: (
    peer: PubSubPeer,
    topic: Topic,
    data: unknown
  ) => void;
  readonly bufferHardOffline: (
    source: EndpointId,
    peers: ReadonlyMap<EndpointId, PubSubPeer>,
    topic: Topic,
    data: unknown
  ) => void;
  readonly onPeerClose: (
    endpointId: EndpointId,
    topics: readonly Topic[]
  ) => void;
  readonly flushOnSubscribe: (
    endpointId: EndpointId,
    topic: Topic,
    deliver: (topic: Topic, data: unknown) => void
  ) => void;
  readonly clear: () => void;
};

function ensureOffline(
  offline: Map<EndpointId, OfflineBuffer>,
  endpointId: EndpointId,
  topics: ReadonlySet<Topic>
): OfflineBuffer {
  let entry = offline.get(endpointId);
  if (entry === undefined) {
    entry = { topics: new Set(topics), messages: [] };
    offline.set(endpointId, entry);
  }
  return entry;
}

/**
 * Optional QoS-1-ish offline buffer for harness pubsub when
 * `liveResendOnReconnect` is enabled. No-ops when disabled.
 */
export function createOfflineBuffers(resendOn: boolean): OfflineBuffers {
  const offline = new Map<EndpointId, OfflineBuffer>();

  return {
    bufferSoftOffline(peer, topic, data) {
      if (!resendOn) return;
      if (!peer.interestedTopics.has(topic)) return;
      appendBuffered(
        ensureOffline(offline, peer.endpointId, peer.interestedTopics),
        topic,
        data
      );
    },
    bufferHardOffline(source, peers, topic, data) {
      if (!resendOn) return;
      for (const [endpointId, entry] of offline) {
        if (endpointId === source) continue;
        if (peers.has(endpointId)) continue;
        if (!entry.topics.has(topic)) continue;
        appendBuffered(entry, topic, data);
      }
    },
    onPeerClose(endpointId, topics) {
      if (!resendOn) return;
      ensureOffline(offline, endpointId, new Set(topics));
    },
    flushOnSubscribe(endpointId, topic, deliver) {
      if (!resendOn) return;
      const entry = offline.get(endpointId);
      if (entry === undefined) return;
      const pending = entry.messages.filter((m) => m.topic === topic);
      entry.messages = entry.messages.filter((m) => m.topic !== topic);
      for (const m of pending) deliver(m.topic, m.data);
      entry.topics.delete(topic);
      if (entry.topics.size === 0 && entry.messages.length === 0) {
        offline.delete(endpointId);
      }
    },
    clear() {
      offline.clear();
    },
  };
}
