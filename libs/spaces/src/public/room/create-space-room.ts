import type { Clock, Timers } from '@pkgs/clock';
import type { Kv } from '@pkgs/kv/interface';
import {
  type ClientTransport,
  CancelScheduleEffect,
  RoomClient,
  ScheduleEffect,
  type RoomCommandPayload,
  type RoomEvent,
  type RoomState,
} from '@pkgs/room';
import {
  KeyValueClientRoomStorage,
  keyValueRoomClientKeywords,
} from '@pkgs/room/client/adapters/storage/key-value';
import type { CreateId, Random } from '@pkgs/uuid';

import type { SpaceRoomModule } from '../module/space-module-context';
import {
  type CreateRoomTransport,
  WebSocketRoomTransportFactory,
} from './room-transport-factory';

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
  /** Defaults to WebSocket when omitted (production). */
  createTransport?: CreateRoomTransport;
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
    const wsFactory = new WebSocketRoomTransportFactory(
      this.timers,
      this.random
    );
    const transport = (createTransport ?? ((args) => wsFactory.create(args)))({
      spaceId,
      apiUrl,
      identity: myId,
      installId,
      clientId,
      getSessionToken,
      timers: this.timers,
      random: this.random,
    });
    const { committed, queue } = keyValueRoomClientKeywords(spaceId);
    const clientStorage = new KeyValueClientRoomStorage(kv, committed, queue);

    // RoomClient.open is offline-first: hydrate + attach, connect in background.
    // Connect failures do not reject — the room client stays usable locally.
    const room = await RoomClient.open({
      topic,
      module,
      storage: clientStorage,
      transport,
      identity: myId,
      clock: this.clock,
      timers: this.timers,
      createId: this.createId,
      // Space schedules run on the authoritative room. Optimism recognizes
      // their effects but never runs a bot or decides a timeout on a device.
      effectHandlers: [
        {
          apply: (effect) =>
            ScheduleEffect.is(effect) || CancelScheduleEffect.is(effect),
        },
      ],
    });

    return { room, transport };
  }
}
