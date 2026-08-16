/**
 * Session-scoped in-process room node for the system playground.
 * Alice and Bob share one {@link RoomServer} per `space:<id>` topic via
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
  type RoomState,
} from '@pkgs/room';
import { LoopbackRoomTransport } from '@pkgs/room/client/adapters/transport/loopback';
import { RoomServer } from '@pkgs/room/server';
import { InMemoryRoomStorage } from '@pkgs/room/server/adapters/memory';

type SpaceRoomServer = RoomServer<RoomState, Message, Message, string>;

type TopicEntry = {
  readonly server: SpaceRoomServer;
  readonly disposeSchedule: () => void;
  readonly ready: Promise<void>;
};

export type InProcessRoomNode = {
  readonly createTransport: CreateRoomTransport;
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

/**
 * Shared room node for one playground session (both actors).
 */
export function createInProcessRoomNode(io: Io): InProcessRoomNode {
  const topics = new Map<string, TopicEntry>();
  let disposed = false;

  const module = composeSpaceRoomModule(GAME_DEFINITIONS, () => io.clock.now());

  function getOrCreate(topic: string): TopicEntry {
    const existing = topics.get(topic);
    if (existing !== undefined) return existing;

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
    const ready = server.hydrateFromStorage();
    const entry: TopicEntry = {
      server,
      disposeSchedule: schedule.dispose,
      ready,
    };
    topics.set(topic, entry);
    return entry;
  }

  const createTransport: CreateRoomTransport = (args) => {
    if (disposed) {
      throw new Error('InProcessRoomNode: disposed');
    }
    const topic = `space:${args.spaceId}`;
    const entry = getOrCreate(topic);
    // Connection ids must be unique per live socket. `clientId` is a stable
    // open-session latch (shared across remounts / Alice+Bob collisions on the
    // process-wide SpaceOpenSessionStore) — reusing it as connectionId trips
    // RoomServer "duplicate connection id".
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
  };

  return {
    createTransport,
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const entry of topics.values()) {
        entry.disposeSchedule();
      }
      topics.clear();
    },
  };
}
