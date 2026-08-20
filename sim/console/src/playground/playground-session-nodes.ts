/**
 * Playground console node adapters (room + pubsub inspect façades).
 */

import type { InMemoryBus } from '@pkgs/pubsub/testing/in-memory';
import type {
  createPlaygroundLogBuffer,
  PlaygroundPubSubNode,
  PlaygroundRoomNode,
} from '@pkgs/sim-console/client';
import type { InProcessRoomNode } from '@sim/console/playground/in-process-room-node';

export function makePlaygroundRoomNode(
  topic: string,
  roomNode: InProcessRoomNode,
  logs: ReturnType<typeof createPlaygroundLogBuffer>
): PlaygroundRoomNode {
  return {
    id: topic,
    address: `room:${topic}`,
    logs,
    inspect() {
      const snap = roomNode.inspect(topic);
      if (snap === null) return null;
      return {
        topic: snap.topic,
        committedState: snap.committedState,
        roster: snap.roster,
        lastSeq: snap.storage?.lastSeq ?? 0,
        entries: snap.storage?.entries ?? [],
        dedupSize: snap.storage?.dedupSize ?? 0,
      };
    },
  };
}

export function makePlaygroundPubSubNode(
  bus: InMemoryBus,
  logs: ReturnType<typeof createPlaygroundLogBuffer>
): PlaygroundPubSubNode {
  return {
    id: 'events',
    address: 'events',
    logs,
    listTopicStats() {
      const byTopic = new Map<
        string,
        { subscriberCount: number; instanceCount: number }
      >();
      for (const instance of bus.listInstances()) {
        for (const row of instance.topicStatsForTest()) {
          const cur = byTopic.get(row.topic) ?? {
            subscriberCount: 0,
            instanceCount: 0,
          };
          cur.subscriberCount += row.subscriberCount;
          cur.instanceCount += 1;
          byTopic.set(row.topic, cur);
        }
      }
      return [...byTopic.entries()].map(([topic, stats]) => ({
        topic,
        subscriberCount: stats.subscriberCount,
        instanceCount: stats.instanceCount,
      }));
    },
  };
}
