/**
 * In-process multi-topic room host for harnesses and the product harness.
 * Clients share one {@link RoomServer} per `space:<id>` topic via
 * {@link LoopbackRoomTransport} — no browser WebSocket / Durable Object.
 *
 * The games a space can host are an argument: the product passes its whole
 * registry, a feature's spec passes the games it composes (or none).
 *
 * No API gateway stands in front of it, so it asks the harness's stand-in
 * for one ({@link HarnessRoomGateway}) on every connect — the grants the
 * actor holds in the space, decided from the server database exactly as the
 * gateway decides them at upgrade — and admits the connection with them. The
 * space room's gate ({@link authorizeSpaceRoomCommand}) then judges each
 * command, as in the Durable Object.
 */

import type { EnvTime } from '@libs/feature-shared/sync';
import type {
  HarnessRoomGateway,
  HarnessRoomNode,
} from '@libs/harness/composition';
import { PERMISSION } from '@libs/permissions-shared/permission-catalog';
import type { CreateRoomTransport } from '@libs/spaces-client/room-transport-factory';
import type { GameDefinition } from '@libs/spaces-shared/game';
import { composeRoomModules } from '@libs/spaces-shared/load-game-plugins';
import { createSpaceRoomAuthorizer } from '@libs/spaces-shared/space-room-authorize';
import type { Message } from '@pkgs/message-shared/message';
import { LoopbackRoomTransport } from '@pkgs/room-adapter-memory-shared/loopback-transport';
import { InMemoryRoomStorage } from '@pkgs/room-adapter-memory-shared/room-storage';
import { RoomServer } from '@pkgs/room-root-server/room-server';
import { ROOM_SCHEDULER_IDENTITY } from '@pkgs/room-root-shared/builtin';
import { ROOM_SERVICE_IDENTITY } from '@pkgs/room-root-shared/service-identity';
import { createTimerScheduleStack } from '@pkgs/room-root-shared/timer-schedule-stack';
import type { ClientTransport } from '@pkgs/room-root-shared/transport';
import type { RoomModule, RoomState } from '@pkgs/room-root-shared/types';

type SpaceModule = RoomModule<RoomState, Message, Message, string>;

type TopicEntry = {
  readonly server: RoomServer<RoomState, Message, Message, string>;
  readonly storage: InMemoryRoomStorage;
  readonly disposeSchedule: () => void;
  readonly ready: Promise<void>;
};

export type RoomServerApp = HarnessRoomNode & {
  readonly env: EnvTime;
  readonly createTransport: CreateRoomTransport;
  /** Deliver a captured scheduler wake through the same server admission path. */
  readonly dispatchScheduled: (
    topic: string,
    payload: Message
  ) => Promise<void>;
};

function withReadyGate(
  inner: ClientTransport,
  ready: (cancelled: () => boolean) => Promise<void>
): ClientTransport {
  let destroyed = false;
  return {
    get isConnected() {
      return inner.isConnected;
    },
    async connect() {
      try {
        await ready(() => destroyed);
      } catch (cause) {
        if (!destroyed) throw cause;
      }
      if (!destroyed) return inner.connect();
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
      destroyed = true;
      inner.destroy();
    },
  };
}

function createTopicEntry(
  topic: string,
  env: EnvTime,
  module: SpaceModule,
  games: readonly GameDefinition[]
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
    authorize: createSpaceRoomAuthorizer(games),
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

type TransportArgs = Parameters<CreateRoomTransport>[0];

/** Who is connecting, as the gateway would resolve them. */
function actorOf(args: TransportArgs) {
  return {
    memberId: args.identity,
    deviceId: args.installId,
    accountId: args.identity === args.installId ? null : args.identity,
  };
}

function buildLoopbackTransport(
  env: EnvTime,
  entry: TopicEntry,
  admission: {
    readonly args: TransportArgs;
    readonly gateway: HarnessRoomGateway;
  }
): ClientTransport {
  const { args, gateway } = admission;
  const connectionId = env.createId();
  let grants: readonly string[] = [];
  const transport = new LoopbackRoomTransport({
    server: {
      registerConnection(id, send, actor, options) {
        for (const stale of entry.server.connectionIdsForActor(
          actor.id,
          actor.clientId
        )) {
          entry.server.unregisterConnection(stale);
        }
        entry.server.registerConnection(id, send, actor, {
          ...options,
          grants,
        });
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
  return withReadyGate(transport, async (cancelled) => {
    await entry.ready;
    if (cancelled()) return;
    // Every open asks the client for its session token first, as the web
    // transport's URL factory does (a host whose space was just created waits
    // there for it to reach the server before the socket opens).
    await args.getSessionToken();
    if (cancelled()) return;
    grants = await gateway.roomGrants({
      topic: entry.server.topic,
      actor: actorOf(args),
    });
    const admissionKey =
      args.module === 'space'
        ? PERMISSION.spacesLeave
        : PERMISSION.chessMultiplayerWatch;
    if (
      !grants.includes(admissionKey) &&
      !(args.module === 'space' && grants.includes(PERMISSION.spacesJoin))
    )
      throw new Error('not in the space');
  });
}

/**
 * The only room-server constructor for the in-process host — wall and harness
 * pass different {@link EnvTime} implementations. Wall DO path uses
 * `createRoomServerDurableObject` instead.
 */
export function createInProcessRoomNode(
  env: EnvTime,
  deps: {
    readonly games: readonly GameDefinition[];
    readonly gateway: HarnessRoomGateway;
  }
): RoomServerApp {
  const { games, gateway } = deps;
  const topics = new Map<string, TopicEntry>();
  const listeners = new Set<() => void>();
  let disposed = false;
  const modules = composeRoomModules(games, () => env.clock.now(), env.random);

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
    const module = modules.find((item) => topic.startsWith(`${item.name}:`));
    if (module === undefined) throw new Error(`Unknown room topic ${topic}`);
    const entry = createTopicEntry(topic, env, module, games);
    topics.set(topic, entry);
    notify();
    return entry;
  };

  return {
    env,
    async dispatchScheduled(topic, payload) {
      const entry = getOrCreate(topic);
      await entry.ready;
      await entry.server.injectCommand({
        id: env.createId(),
        identity: ROOM_SCHEDULER_IDENTITY,
        payload,
      });
    },
    services: {
      async read(topic) {
        const entry = getOrCreate(topic);
        await entry.ready;
        return entry.server.readCommittedState();
      },
      async send(topic, commandId, payload) {
        const entry = getOrCreate(topic);
        await entry.ready;
        await entry.server.injectServiceCommand({
          id: commandId,
          identity: ROOM_SERVICE_IDENTITY,
          payload,
        });
      },
      async eraseIdentity(topic, identity, replacement) {
        const entry = getOrCreate(topic);
        await entry.ready;
        await entry.server.eraseIdentity({ identity, replacement });
      },
      async disconnect(topic, identity) {
        const entry = getOrCreate(topic);
        await entry.ready;
        entry.server.disconnectActor(identity);
      },
    },
    createTransport: (args) => {
      if (disposed) throw new Error('RoomServerApp: disposed');
      return buildLoopbackTransport(env, getOrCreate(args.topic), {
        args,
        gateway,
      });
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
