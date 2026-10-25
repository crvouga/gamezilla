import { SpaceMembersRoomAttr } from '@libs/spaces-shared-ts/space-members-messages';
import type { Clock, Timers } from '@pkgs/clock-shared-ts/types';
import type { Kv } from '@pkgs/kv-root-shared-ts/interface';
import { keyValueRoomClientKeywords } from '@pkgs/room-root-client-ts/keys';
import { RoomClient } from '@pkgs/room-root-client-ts/room-client';
import { KeyValueClientRoomStorage } from '@pkgs/room-root-client-ts/storage';
import {
  CancelScheduleEffect,
  ScheduleEffect,
} from '@pkgs/room-root-shared-ts/builtin';
import type { ClientTransport } from '@pkgs/room-root-shared-ts/transport';
import type {
  RoomCommandPayload,
  RoomEvent,
  RoomState,
} from '@pkgs/room-root-shared-ts/types';
import type { CreateId, Random } from '@pkgs/uuid-shared-ts/create-id';
import type { CreateRoomTransport } from './room-transport-factory';
import { startSpaceHostSchedules } from './space-host-schedules';
import type { SpaceRoomModule } from './space-module-context';

export type CreateSpaceRoomParams = {
  spaceId: string;
  apiUrl: string;
  /**
   * Composed space {@link RoomModule}, constructed by the composition root
   * via `createSpaceModule(name, [...])`. Threaded in (rather than imported here)
   * so `@libs/spaces` stays game-agnostic.
   */
  module: SpaceRoomModule;
  /**
   * Client {@link Kv} (e.g. `KvPlatform` — localStorage on web, a key-value
   * store on native). Must not use `SecureStorage` / secure-store for this blob:
   * room committed log + outbound queue exceed the 2048-byte per-value cap
   * once a handful of entries accumulate.
   */
  kv: Kv;
  /** Member actor id (`accountId ?? deviceId`); space DO auth + local room handle. */
  myId: string;
  hostsSpace: boolean;
  /** Install UUID — required with bearer JWT for `/room` device binding. */
  installId: string;
  /** Per-tab client id for the live roster. */
  clientId: string;
  /**
   * Fresh bearer for `/room?token=` — called on every WebSocket open
   * (including transport reconnects). May be async so the client can
   * refresh a rotated JWT before the socket upgrade.
   */
  getSessionToken: () => string | null | Promise<string | null>;
  /** Injected by the client composition, including its offline boundary. */
  createTransport: CreateRoomTransport;
};

export type CreateSpaceRoomResult = {
  room: RoomClient<RoomState, RoomCommandPayload, RoomEvent, string>;
  transport: ClientTransport;
};

export class SpaceRoomFactory {
  constructor(
    private readonly clock: Clock,
    private readonly timers: Timers,
    private readonly createId: CreateId,
    private readonly random: Random
  ) {}

  /**
   * Opens a space room client for local-first UI. Returns after local hydrate;
   * the WebSocket may still be connecting (or offline). Callers must register
   * the room client immediately so optimistic commands work while Connecting… shows.
   */
  async create(params: CreateSpaceRoomParams): Promise<CreateSpaceRoomResult> {
    const {
      spaceId,
      apiUrl,
      module,
      kv,
      myId,
      installId,
      clientId,
      getSessionToken,
      createTransport,
    } = params;
    const topic = `space:${spaceId}`;
    const transport = createTransport({
      topic,
      module: module.name,
      apiUrl,
      identity: myId,
      installId,
      clientId,
      getSessionToken,
      clock: this.clock,
      timers: this.timers,
      random: this.random,
    });
    const { committed, queue } = keyValueRoomClientKeywords(spaceId);
    const clientStorage = new KeyValueClientRoomStorage(kv, committed, queue);

    // RoomClient.open is offline-first: hydrate + attach, connect in background.
    // Connect failures do not reject — the room client stays usable locally.
    let stopSchedules = (): void => {};
    const room = await RoomClient.open({
      onDestroy: () => stopSchedules(),
      topic,
      module: {
        ...module,
        handle: (state, command, identity) =>
          module.handle(
            params.hostsSpace
              ? {
                  ...state,
                  ...SpaceMembersRoomAttr.seats({
                    ...SpaceMembersRoomAttr.seats.from(state),
                    [myId]: {
                      joinedAt: new Date(this.clock.now()).toISOString(),
                    },
                  }),
                }
              : state,
            command,
            identity
          ),
      },
      storage: clientStorage,
      transport,
      identity: myId,
      clock: this.clock,
      timers: this.timers,
      createId: this.createId,
      // Game definitions separately recover host schedules from local state.
      // Server effects remain recognized during optimistic command replay.
      effectHandlers: [
        {
          apply: (effect) =>
            ScheduleEffect.is(effect) || CancelScheduleEffect.is(effect),
        },
      ],
    });

    if (params.hostsSpace)
      stopSchedules = startSpaceHostSchedules(room, module, {
        clock: this.clock,
        timers: this.timers,
        createId: this.createId,
        topic,
      });
    return { room, transport };
  }
}
