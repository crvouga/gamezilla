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

import type { Clock, Timers } from '@pkgs/clock';
import {
  createTimerScheduleStack,
  type RoomActor,
  type RoomCommandPayload,
  type RoomEvent,
  type RoomModule,
  type RoomState,
} from '@pkgs/room';
import { RoomServer } from '@pkgs/room/server';
import { InMemoryRoomStorage } from '@pkgs/room-adapter-memory';
import type { CreateId } from '@pkgs/uuid';

/** Per-connection state Bun carries on the socket. */
export type BunRoomSocketData = {
  readonly topic: string;
  readonly moduleName: string;
  readonly connId: string;
  readonly actor: RoomActor;
};

type AnyModule = RoomModule<RoomState, RoomCommandPayload, RoomEvent, string>;
type AnyServer = RoomServer<RoomState, RoomCommandPayload, RoomEvent, string>;

export type BunRoomHostDeps = {
  readonly modules: readonly AnyModule[];
  readonly clock: Clock;
  readonly timers: Timers;
  readonly createId: CreateId;
};

export type BunRoomHost = {
  /** Resolve the connection data for an upgrade, or `null` to refuse it. */
  accept(args: {
    readonly topic: string;
    readonly moduleName: string;
    readonly actorId: string;
    readonly clientId: string;
  }): BunRoomSocketData | null;
  open(data: BunRoomSocketData, send: (raw: string) => void): Promise<void>;
  message(data: BunRoomSocketData, raw: string): Promise<void>;
  close(data: BunRoomSocketData): void;
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

export function createBunRoomHost(deps: BunRoomHostDeps): BunRoomHost {
  const modules = new Map<string, AnyModule>(
    deps.modules.map((module) => [module.name, module])
  );
  const entries = new Map<string, Entry>();

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
      };
    },
    async open(data, send) {
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
        data.actor
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
      const entry = entries.get(entryKey(data.topic, data.moduleName));
      if (entry === undefined) return;
      if (entry.server.hasConnection(data.connId)) {
        entry.server.unregisterConnection(data.connId);
      }
    },
    listTopics: () => [...entries.keys()],
    dispose() {
      for (const entry of entries.values()) entry.disposeSchedule();
      entries.clear();
    },
  };
}
