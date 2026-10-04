/**
 * Bun WebSocket host for `@pkgs/room`.
 *
 * Production hosts rooms in a Durable Object; a Durable Object is a
 * single-threaded, topic-addressed actor. This adapter reproduces that shape
 * on a Bun server: one {@link RoomServer} per `(topic, module)`, owned by one
 * process, reached over a real WebSocket speaking the same wire protocol the
 * browser transport already speaks.
 *
 * Placement is the caller's job. A load balancer in front of several nodes
 * must route a topic to the same node every time, exactly as
 * `idFromName(topic)` does — otherwise two clients in one room end up talking
 * to two different authorities.
 */

import type { Clock, Timers } from '@pkgs/clock-shared/types';
import { InMemoryRoomStorage } from '@pkgs/room-adapter-memory-shared/room-storage';
import { handleRoomService } from '@pkgs/room-root-server/handle-room-service';
import { RoomServer } from '@pkgs/room-root-server/room-server';
import type { RoomServerConfig } from '@pkgs/room-root-shared/room-server-types';
import { ROOM_SERVICE_IDENTITY } from '@pkgs/room-root-shared/service-identity';
import { createTimerScheduleStack } from '@pkgs/room-root-shared/timer-schedule-stack';
import type {
  RoomActor,
  RoomCommandPayload,
  RoomEvent,
  RoomModule,
  RoomState,
} from '@pkgs/room-root-shared/types';
import type { CreateId } from '@pkgs/uuid-shared/create-id';

/** Per-connection state Bun carries on the socket. */
export type BunRoomSocketData = {
  readonly topic: string;
  readonly moduleName: string;
  readonly connId: string;
  readonly actor: RoomActor;
  /** Grants the gateway admitted the connection with. */
  readonly grants: readonly string[];
};

type AnyModule = RoomModule<RoomState, RoomCommandPayload, RoomEvent, string>;
type AnyServer = RoomServer<RoomState, RoomCommandPayload, RoomEvent, string>;

export type BunRoomHostDeps = {
  readonly modules: readonly AnyModule[];
  readonly clock: Clock;
  readonly timers: Timers;
  readonly createId: CreateId;
  /** Per-command gate for every hosted room (see `RoomServerConfig`). */
  readonly authorize?: RoomServerConfig<
    RoomState,
    RoomCommandPayload,
    RoomEvent,
    string
  >['authorize'];
};

export type BunRoomHost = {
  /** Resolve the connection data for an upgrade, or `null` to refuse it. */
  accept(args: {
    readonly topic: string;
    readonly moduleName: string;
    readonly actorId: string;
    readonly clientId: string;
    /** Decided by the gateway in front of this host; none when absent. */
    readonly grants?: readonly string[];
  }): BunRoomSocketData | null;
  open(
    data: BunRoomSocketData,
    send: (raw: string) => void,
    close: () => void
  ): Promise<void>;
  message(data: BunRoomSocketData, raw: string): Promise<void>;
  close(data: BunRoomSocketData): void;
  service(
    topic: string,
    moduleName: string,
    request: Request
  ): Promise<Response>;
  listTopics(): readonly string[];
  dispose(): void;
};

type Entry = {
  readonly server: AnyServer;
  readonly ready: Promise<void>;
  readonly disposeSchedule: () => void;
};

function entryKey(topic: string, moduleName: string): string {
  return `${moduleName}|${topic}`;
}

function createEntry(
  deps: BunRoomHostDeps,
  topic: string,
  module: AnyModule
): Entry {
  const schedule = createTimerScheduleStack({
    clock: deps.clock,
    timers: deps.timers,
    createId: deps.createId,
    topic,
  });
  const server: AnyServer = new RoomServer({
    topic,
    module,
    storage: new InMemoryRoomStorage(),
    clock: deps.clock,
    ...(deps.authorize === undefined ? {} : { authorize: deps.authorize }),
    effectHandlers: [schedule.handler],
  });
  schedule.bindInject((cmd) =>
    server.injectCommand({
      id: cmd.id,
      payload: cmd.payload,
      identity: cmd.identity,
    })
  );
  return {
    server,
    ready: server.hydrateFromStorage(),
    disposeSchedule: schedule.dispose,
  };
}

type HostedSocket = { data: BunRoomSocketData; close: () => void };

function createService(
  entryFor: (topic: string, moduleName: string) => Entry | null,
  sockets: Map<string, HostedSocket>
): BunRoomHost['service'] {
  return async (topic, moduleName, request) => {
    const entry = entryFor(topic, moduleName);
    if (entry === null || topic.length === 0)
      return new Response(null, { status: 400 });
    await entry.ready;
    return handleRoomService(request, entry.server, {
      identity: ROOM_SERVICE_IDENTITY,
      disconnect: (identity) => {
        for (const [id, socket] of sockets) {
          if (
            socket.data.topic !== topic ||
            socket.data.moduleName !== moduleName
          )
            continue;
          if (identity !== null && socket.data.actor.id !== identity) continue;
          sockets.delete(id);
          socket.close();
        }
      },
    });
  };
}

export function createBunRoomHost(deps: BunRoomHostDeps): BunRoomHost {
  const modules = new Map<string, AnyModule>(
    deps.modules.map((module) => [module.name, module])
  );
  const entries = new Map<string, Entry>();
  const sockets = new Map<string, HostedSocket>();

  const entryFor = (topic: string, moduleName: string): Entry | null => {
    const module = modules.get(moduleName);
    if (module === undefined) return null;
    const key = entryKey(topic, moduleName);
    const existing = entries.get(key);
    if (existing !== undefined) return existing;
    const created = createEntry(deps, topic, module);
    entries.set(key, created);
    return created;
  };

  return {
    accept(args) {
      if (args.topic.length === 0) return null;
      if (!modules.has(args.moduleName)) return null;
      return {
        topic: args.topic,
        moduleName: args.moduleName,
        connId: deps.createId(),
        actor: { id: args.actorId, clientId: args.clientId },
        grants: args.grants ?? [],
      };
    },
    async open(data, send, close) {
      sockets.set(data.connId, { data, close });
      const entry = entryFor(data.topic, data.moduleName);
      if (entry === null) return;
      await entry.ready;
      // A reconnect from the same tab supersedes its previous socket, so the
      // roster cannot accumulate ghosts.
      for (const stale of entry.server.connectionIdsForActor(
        data.actor.id,
        data.actor.clientId
      )) {
        entry.server.unregisterConnection(stale);
      }
      entry.server.registerConnection(
        data.connId,
        (payload) => send(JSON.stringify(payload)),
        data.actor,
        { grants: data.grants }
      );
    },
    async message(data, raw) {
      const entry = entryFor(data.topic, data.moduleName);
      if (entry === null) return;
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        return;
      }
      await entry.server.handleClientMessage(
        data.connId,
        data.actor.id,
        parsed
      );
    },
    close(data) {
      sockets.delete(data.connId);
      const entry = entries.get(entryKey(data.topic, data.moduleName));
      if (entry === undefined) return;
      if (entry.server.hasConnection(data.connId)) {
        entry.server.unregisterConnection(data.connId);
      }
    },
    service: createService(entryFor, sockets),
    listTopics: () => [...entries.keys()],
    dispose() {
      for (const entry of entries.values()) entry.disposeSchedule();
      entries.clear();
      for (const socket of sockets.values()) socket.close();
      sockets.clear();
    },
  };
}
