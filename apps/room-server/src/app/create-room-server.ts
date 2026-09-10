/**
 * In-process multi-topic room host for sim / product-simulator.
 * Clients share one {@link RoomServer} per `space:<id>` topic via
 * {@link LoopbackRoomTransport} — no browser WebSocket / Durable Object.
 */

import { GAME_DEFINITIONS } from '@libs/games/game-plugins';
import { composeSpaceRoomModule } from '@libs/spaces/public/load-game-plugins';
import type { CreateRoomTransport } from '@libs/spaces/root/client/room/room-transport-factory';
import type { Message } from '@pkgs/message';
import {
  type ClientTransport,
  createTimerScheduleStack,
  type RoomActor,
  type RoomModule,
  type RoomState,
} from '@pkgs/room';
import { RoomServer } from '@pkgs/room/server';
import {
  InMemoryRoomStorage,
  LoopbackRoomTransport,
  type RoomStorageTopicReplace,
  type RoomStorageTopicSnapshot,
} from '@pkgs/room-adapter-memory';
import type { RoomServerEnv } from './room-server-env';

type SpaceModule = RoomModule<RoomState, Message, Message, string>;

type TopicEntry = {
  readonly server: RoomServer<RoomState, Message, Message, string>;
  readonly storage: InMemoryRoomStorage;
  readonly disposeSchedule: () => void;
  readonly ready: Promise<void>;
};

export type RoomServerInspect = {
  readonly topic: string;
  readonly committedState: RoomState;
  readonly roster: readonly RoomActor[];
  readonly storage: RoomStorageTopicSnapshot | null;
};

export type RoomServerApp = {
  readonly env: RoomServerEnv;
  readonly createTransport: CreateRoomTransport;
  listTopics(): readonly string[];
  inspect(topic: string): RoomServerInspect | null;
  exportTopic(topic: string): RoomStorageTopicSnapshot | null;
  replaceTopic(topic: string, next: RoomStorageTopicReplace): Promise<void>;
  dropTopic(topic: string): void;
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
  env: RoomServerEnv,
  module: SpaceModule
): TopicEntry {
  const storage = new InMemoryRoomStorage();
  const schedule = createTimerScheduleStack({
    clock: env.clock,
    timers: env.timers,
    createId: env.createId,
    topic,
  });
  const server = new RoomServer<RoomState, Message, Message, string>({
    topic,
    module,
    storage,
    clock: env.clock,
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
  env: RoomServerEnv,
  entry: TopicEntry,
  args: Parameters<CreateRoomTransport>[0]
): ClientTransport {
  const connectionId = env.createId();
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
 * The only room-server constructor for the in-process host — wall and sim
 * pass different {@link RoomServerEnv} implementations. Wall DO path uses
 * `createRoomServerDurableObject` instead.
 */
export function createRoomServer(env: RoomServerEnv): RoomServerApp {
  const topics = new Map<string, TopicEntry>();
  const listeners = new Set<() => void>();
  let disposed = false;
  const module = composeSpaceRoomModule(GAME_DEFINITIONS, () =>
    env.clock.now()
  );

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
    const entry = createTopicEntry(topic, env, module);
    topics.set(topic, entry);
    notify();
    return entry;
  };

  return {
    env,
    createTransport: (args) => {
      if (disposed) throw new Error('RoomServerApp: disposed');
      return buildLoopbackTransport(
        env,
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
      if (disposed) throw new Error('RoomServerApp: disposed');
      const entry = getOrCreate(topic);
      entry.storage.replaceTopic(topic, next);
      await entry.server.hydrateFromStorage();
      notify();
    },
    dropTopic(topic) {
      const entry = topics.get(topic);
      if (entry === undefined) return;
      entry.disposeSchedule();
      topics.delete(topic);
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
