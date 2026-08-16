/**
 * Session-scoped in-process room node for the system playground.
 * Clients share one {@link RoomServer} per `space:<id>` topic via
 * {@link LoopbackRoomTransport} — no browser WebSocket / Durable Object.
 */

import { GAME_DEFINITIONS } from '@libs/games/game-plugins';
import type { CreateRoomTransport } from '@libs/spaces/client/room/room-transport-factory';
import { composeSpaceRoomModule } from '@libs/spaces/shared/load-game-plugins';
import type { Io } from '@pkgs/io';
import type { Message } from '@pkgs/message';
import {
  type ClientTransport,
  createTimerScheduleStack,
  type RoomActor,
  type RoomModule,
  type RoomState,
} from '@pkgs/room';
import { LoopbackRoomTransport } from '@pkgs/room/client/adapters/transport/loopback';
import { RoomServer } from '@pkgs/room/server';
import {
  InMemoryRoomStorage,
  type RoomStorageTopicReplace,
  type RoomStorageTopicSnapshot,
} from '@pkgs/room/server/adapters/memory';

type SpaceRoomServer = RoomServer<RoomState, Message, Message, string>;
type SpaceModule = RoomModule<RoomState, Message, Message, string>;

type TopicEntry = {
  readonly server: SpaceRoomServer;
  readonly storage: InMemoryRoomStorage;
  readonly disposeSchedule: () => void;
  readonly ready: Promise<void>;
};

export type InProcessRoomInspect = {
  readonly topic: string;
  readonly committedState: RoomState;
  readonly roster: readonly RoomActor[];
  readonly storage: RoomStorageTopicSnapshot | null;
};

export type InProcessRoomNode = {
  readonly createTransport: CreateRoomTransport;
  listTopics(): readonly string[];
  inspect(topic: string): InProcessRoomInspect | null;
  exportTopic(topic: string): RoomStorageTopicSnapshot | null;
  replaceTopic(topic: string, next: RoomStorageTopicReplace): Promise<void>;
  subscribe(listener: () => void): () => void;
  dispose(): void;
};

function withReadyGate(
  inner: ClientTransport,
  ready: Promise<void>
): ClientTransport {
  return {
    get isConnected() {
      return inner.isConnected;
    },
    async connect() {
      await ready;
      return inner.connect();
    },
    sendJson(payload) {
      inner.sendJson(payload);
    },
    subscribe(handler) {
      return inner.subscribe(handler);
    },
    onHandlers(h) {
      return inner.onHandlers(h);
    },
    destroy() {
      inner.destroy();
    },
  };
}

function createTopicEntry(
  topic: string,
  io: Io,
  module: SpaceModule
): TopicEntry {
  const storage = new InMemoryRoomStorage();
  const schedule = createTimerScheduleStack({
    clock: io.clock,
    timers: io.timers,
    createId: io.createId,
    topic,
  });
  const server = new RoomServer<RoomState, Message, Message, string>({
    topic,
    module,
    storage,
    clock: io.clock,
    effectHandlers: [schedule.handler],
  });
  schedule.bindInject((cmd) =>
    server.injectCommand({
      id: cmd.id,
      payload: cmd.payload as Message,
      identity: cmd.identity,
    })
  );
  return {
    server,
    storage,
    disposeSchedule: schedule.dispose,
    ready: server.hydrateFromStorage(),
  };
}

function buildLoopbackTransport(
  io: Io,
  entry: TopicEntry,
  args: Parameters<CreateRoomTransport>[0]
): ClientTransport {
  const connectionId = io.createId();
  const transport = new LoopbackRoomTransport({
    server: {
      registerConnection(id, send, actor, options) {
        for (const stale of entry.server.connectionIdsForActor(
          actor.id,
          actor.clientId
        )) {
          entry.server.unregisterConnection(stale);
        }
        entry.server.registerConnection(id, send, actor, options);
      },
      unregisterConnection(id) {
        entry.server.unregisterConnection(id);
      },
      handleClientMessage(connectionId, identity, raw) {
        return entry.server.handleClientMessage(connectionId, identity, raw);
      },
    },
    connectionId,
    identity: args.identity,
    clientId: args.clientId,
  });
  return withReadyGate(transport, entry.ready);
}

/**
 * Shared room node for one playground session.
 */
export function createInProcessRoomNode(io: Io): InProcessRoomNode {
  const topics = new Map<string, TopicEntry>();
  const listeners = new Set<() => void>();
  let disposed = false;
  const module = composeSpaceRoomModule(GAME_DEFINITIONS, () => io.clock.now());

  const notify = () => {
    for (const listener of [...listeners]) {
      try {
        listener();
      } catch {
        // Ignore listener errors.
      }
    }
  };

  const getOrCreate = (topic: string): TopicEntry => {
    const existing = topics.get(topic);
    if (existing !== undefined) return existing;
    const entry = createTopicEntry(topic, io, module);
    topics.set(topic, entry);
    notify();
    return entry;
  };

  return {
    createTransport: (args) => {
      if (disposed) throw new Error('InProcessRoomNode: disposed');
      return buildLoopbackTransport(
        io,
        getOrCreate(`space:${args.spaceId}`),
        args
      );
    },
    listTopics: () => [...topics.keys()],
    inspect(topic) {
      const entry = topics.get(topic);
      if (entry === undefined) return null;
      return {
        topic,
        committedState: entry.server.getCommittedState(),
        roster: entry.server.getRoster(),
        storage: entry.storage.snapshotTopic(topic),
      };
    },
    exportTopic(topic) {
      const entry = topics.get(topic);
      if (entry === undefined) return null;
      return entry.storage.exportTopic(topic);
    },
    async replaceTopic(topic, next) {
      if (disposed) throw new Error('InProcessRoomNode: disposed');
      const entry = getOrCreate(topic);
      entry.storage.replaceTopic(topic, next);
      await entry.server.hydrateFromStorage();
      notify();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const entry of topics.values()) entry.disposeSchedule();
      topics.clear();
      listeners.clear();
    },
  };
}
