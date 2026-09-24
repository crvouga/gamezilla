/**
 * In-process multi-topic room host for sims and the product simulator.
 * Clients share one {@link RoomServer} per `space:<id>` topic via
 * {@link LoopbackRoomTransport} — no browser WebSocket / Durable Object.
 *
 * The games a space can host are an argument: the product passes its whole
 * registry, a feature's e2e passes the games it composes (or none).
 */

import type { EnvTime } from '@libs/feature/public/sync';
import type { SimRoomNode } from '@libs/sim-harness/composition';
import type { Message } from '@pkgs/message';
import {
  type ClientTransport,
  createTimerScheduleStack,
  type RoomModule,
  type RoomState,
} from '@pkgs/room';
import { RoomServer } from '@pkgs/room/server';
import {
  InMemoryRoomStorage,
  LoopbackRoomTransport,
} from '@pkgs/room-adapter-memory';
import type { GameDefinition } from '../public/game';
import { composeSpaceRoomModule } from '../public/load-game-plugins';
import type { CreateRoomTransport } from '../root/client/room/room-transport-factory';

type SpaceModule = RoomModule<RoomState, Message, Message, string>;

type TopicEntry = {
  readonly server: RoomServer<RoomState, Message, Message, string>;
  readonly storage: InMemoryRoomStorage;
  readonly disposeSchedule: () => void;
  readonly ready: Promise<void>;
};

export type RoomServerApp = SimRoomNode & {
  readonly env: EnvTime;
  readonly createTransport: CreateRoomTransport;
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
  env: EnvTime,
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
  env: EnvTime,
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
 * pass different {@link EnvTime} implementations. Wall DO path uses
 * `createRoomServerDurableObject` instead.
 */
export function createInProcessRoomNode(
  env: EnvTime,
  games: readonly GameDefinition[]
): RoomServerApp {
  const topics = new Map<string, TopicEntry>();
  const listeners = new Set<() => void>();
  let disposed = false;
  const module = composeSpaceRoomModule(games, () => env.clock.now());

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
