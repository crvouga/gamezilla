import type { ConfigService } from '@libs/auth-shared/config-service-types';
import type { SpaceRoomConnectionBootstrap } from '@libs/spaces-shared/space-room-connection-bootstrap';
import { useClock, useTimers } from '@pkgs/clock-client/solid';
import type { Clock, Timers } from '@pkgs/clock-shared/types';
import type { Kv } from '@pkgs/kv-root-shared/interface';
import { useLogger } from '@pkgs/logger-client/solid';
import type { Logger } from '@pkgs/logger-shared/logger';
import type { RoomClient } from '@pkgs/room-root-client/room-client';
import type { ClientTransport } from '@pkgs/room-root-shared/transport';
import type {
  RoomCommandPayload,
  RoomEvent,
  RoomState,
} from '@pkgs/room-root-shared/types';
import { useSyncEngineInstance } from '@pkgs/sync-engine-client/sync-engine-context';
import { useCreateId, useRandom } from '@pkgs/uuid-client/solid';
import type { CreateId, Random } from '@pkgs/uuid-shared/create-id';
import {
  type Accessor,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  untrack,
} from 'solid-js';
import type { CreateSpaceRoomResult } from './create-space-room';
import { SpaceRoomFactory } from './create-space-room';
import { useCreateRoomTransport } from './room-transport-factory';
import {
  admissionLanded,
  type SpaceAdmissionsInFlight,
  useSpaceAdmissionsInFlight,
} from './space-admissions-in-flight';
import { useSpaceModule } from './space-module-context';

type SpaceRoom = RoomClient<RoomState, RoomCommandPayload, RoomEvent, string>;

function normalizeSessionToken(t: string | null): string | null {
  if (typeof t !== 'string') return null;
  const trimmed = t.trim();
  return trimmed.length === 0 ? null : trimmed;
}

const FRESH_TOKEN_TIMEOUT_MS = 4_000;

function raceFreshToken(
  timers: Timers,
  getFresh: () => Promise<string | null>
): Promise<string | null> {
  return new Promise((resolve) => {
    let settled = false;
    const done = (v: string | null): void => {
      if (settled) return;
      settled = true;
      resolve(v);
    };
    const timer = timers.setTimeout(() => done(null), FRESH_TOKEN_TIMEOUT_MS);
    void getFresh()
      .then((t) => {
        timers.clearTimeout(timer);
        done(t);
      })
      .catch(() => {
        timers.clearTimeout(timer);
        done(null);
      });
  });
}

type RoomRefs = {
  roomRef: { current: SpaceRoom | null };
  transportRef: { current: ClientTransport | null };
  setRoom: (room: SpaceRoom | null) => void;
  setTransport: (transport: ClientTransport | null) => void;
};

function destroyRoomPair(refs: RoomRefs): void {
  const room = refs.roomRef.current;
  const transport = refs.transportRef.current;
  refs.roomRef.current = null;
  refs.transportRef.current = null;
  refs.setRoom(null);
  refs.setTransport(null);
  room?.destroy();
  transport?.destroy();
}

type OpenSpaceRoomArgs = {
  bootstrap: SpaceRoomConnectionBootstrap;
  bootstrapKey: string;
  configService: ConfigService;
  kv: Kv;
  module: ReturnType<typeof useSpaceModule>;
  getSessionToken: () => Promise<string | null>;
  createTransport: ReturnType<typeof useCreateRoomTransport>;
  clock: Clock;
  timers: Timers;
  logger: Logger;
  createId: CreateId;
  random: Random;
  refs: RoomRefs;
  connectedKeyRef: { current: string | null };
  openingKeyRef: { current: string | null };
  tearDown: () => void;
};

function commitOpenedRoom(
  args: OpenSpaceRoomArgs,
  nextRoom: SpaceRoom,
  nextTransport: ClientTransport
): void {
  const prevRoom = args.refs.roomRef.current;
  const prevTransport = args.refs.transportRef.current;
  args.refs.roomRef.current = nextRoom;
  args.refs.transportRef.current = nextTransport;
  args.connectedKeyRef.current = args.bootstrapKey;
  args.openingKeyRef.current = null;
  args.refs.setRoom(nextRoom);
  args.refs.setTransport(nextTransport);
  if (prevRoom !== null && prevRoom !== nextRoom) prevRoom.destroy();
  if (prevTransport !== null && prevTransport !== nextTransport) {
    prevTransport.destroy();
  }
}

function clearOpeningKey(args: OpenSpaceRoomArgs): void {
  if (args.openingKeyRef.current === args.bootstrapKey) {
    args.openingKeyRef.current = null;
  }
}

function openSpaceRoom(args: OpenSpaceRoomArgs): () => void {
  let cancelled = false;
  void (async (): Promise<void> => {
    let opened: CreateSpaceRoomResult;
    try {
      // Local hydrate first; WS may still be connecting. Commit as soon as
      // createSpaceRoom resolves so Games/Chess dispatch is not a no-op.
      opened = await new SpaceRoomFactory(
        args.clock,
        args.timers,
        args.createId,
        args.random
      ).create({
        spaceId: args.bootstrap.spaceId,
        apiUrl: args.configService.getApiUrl(),
        module: args.module,
        kv: args.kv,
        myId: args.bootstrap.myId,
        hostsSpace: args.bootstrap.hostsSpace,
        installId: args.bootstrap.installId,
        clientId: args.bootstrap.clientId,
        getSessionToken: args.getSessionToken,
        createTransport: args.createTransport,
      });
    } catch (cause) {
      args.logger.error('Could not reopen saved space state', { cause });
      // RoomClient.open is hardened to avoid this; if it still throws, clear
      // the latch so a later bootstrap key change / remount can retry.
      clearOpeningKey(args);
      return;
    }
    if (cancelled) {
      clearOpeningKey(args);
      opened.room.destroy();
      opened.transport.destroy();
      return;
    }
    commitOpenedRoom(args, opened.room, opened.transport);
  })();
  return () => {
    cancelled = true;
  };
}

function shouldSkipOpen(args: {
  bootstrapKey: string;
  hasBearerOrAnon: boolean;
  connectedKey: string | null;
  currentRoom: SpaceRoom | null;
}): boolean {
  if (!args.hasBearerOrAnon) return true;
  return args.connectedKey === args.bootstrapKey && args.currentRoom !== null;
}

function beginOpenSpaceRoom(
  args: OpenSpaceRoomArgs & {
    hasBearerOrAnon: boolean;
  }
): () => void {
  if (
    shouldSkipOpen({
      bootstrapKey: args.bootstrapKey,
      hasBearerOrAnon: args.hasBearerOrAnon,
      connectedKey: args.connectedKeyRef.current,
      currentRoom: args.refs.roomRef.current,
    })
  ) {
    return () => {
      args.tearDown();
    };
  }
  if (
    args.connectedKeyRef.current !== null &&
    args.connectedKeyRef.current !== args.bootstrapKey
  ) {
    args.tearDown();
  }
  args.openingKeyRef.current = args.bootstrapKey;
  const stop = openSpaceRoom(args);
  return () => {
    stop();
    args.tearDown();
  };
}

export type UseSpaceRoomConnectionArgs = {
  bootstrap: Accessor<SpaceRoomConnectionBootstrap | null>;
  configService: ConfigService;
  kv: Kv;
  /** Bearer for `/room`; re-run when bearer availability changes, not on JWT rotation. */
  sessionToken: Accessor<string | null>;
  /** Async refresh used on every socket open so reconnects do not reuse a stale JWT. */
  getFreshToken: () => Promise<string | null>;
};

async function waitForSpaceAdmission(
  engine: ReturnType<typeof useSyncEngineInstance>,
  admissions: SpaceAdmissionsInFlight | null,
  spaceId: string,
  timers: Timers
): Promise<void> {
  const mutationId = admissions?.get(spaceId) ?? null;
  if (mutationId === null) return;
  const outcome = await admissionLanded(engine, { mutationId, timers });
  if (outcome === 'pending')
    throw new Error('Space participation is waiting to sync');
  admissions?.forget(spaceId);
  if (outcome === 'rejected')
    throw new Error('Space participation was refused');
}

export function useSpaceRoomConnection(args: UseSpaceRoomConnectionArgs): {
  room: Accessor<SpaceRoom | null>;
  transport: Accessor<ClientTransport | null>;
} {
  const { bootstrap, configService, kv, sessionToken, getFreshToken } = args;
  const [room, setRoom] = createSignal<SpaceRoom | null>(null);
  const [transport, setTransport] = createSignal<ClientTransport | null>(null);
  const refs: RoomRefs = {
    roomRef: { current: null },
    transportRef: { current: null },
    setRoom,
    setTransport,
  };
  const module = useSpaceModule();
  const createTransport = useCreateRoomTransport();
  const clock = useClock();
  const logger = useLogger('space-room');
  const timers = useTimers();
  const createId = useCreateId();
  const random = useRandom();
  const engine = useSyncEngineInstance();
  const admissions = useSpaceAdmissionsInFlight();
  const connectedKeyRef = { current: null as string | null };
  const openingKeyRef = { current: null as string | null };

  const tearDown = (): void => {
    connectedKeyRef.current = null;
    openingKeyRef.current = null;
    destroyRoomPair(refs);
  };

  const bootstrapKey = createMemo((): string | null => {
    const current = bootstrap();
    if (current === null) return null;
    return `${current.spaceId}:${current.myId}:${current.installId}:${current.clientId}:${String(current.hostsSpace)}`;
  });
  const hasBearerOrAnon = createMemo(() => {
    const hasBearer = normalizeSessionToken(sessionToken()) !== null;
    const current = bootstrap();
    return hasBearer || (current !== null && current.myId.length > 0);
  });

  // Fresh bearer on every socket open; falls back to the ambient token when
  // refresh is unavailable (offline) or times out. New participation must
  // reach the server before the gateway decides the connection's grants.
  const getSessionToken = async (): Promise<string | null> => {
    const spaceId = untrack(() => bootstrap())?.spaceId ?? '';
    await waitForSpaceAdmission(engine, admissions, spaceId, timers);
    let fresh: string | null = null;
    try {
      fresh = await raceFreshToken(timers, getFreshToken);
    } catch {
      fresh = null;
    }
    return normalizeSessionToken(fresh ?? sessionToken());
  };

  createEffect(() => {
    const key = bootstrapKey();
    if (key === null) {
      tearDown();
      return;
    }
    const stop = beginOpenSpaceRoom({
      bootstrap: untrack(() => bootstrap())!,
      bootstrapKey: key,
      configService,
      kv,
      module,
      hasBearerOrAnon: untrack(() => hasBearerOrAnon()),
      getSessionToken,
      createTransport,
      clock,
      timers,
      logger,
      createId,
      random,
      refs,
      connectedKeyRef,
      openingKeyRef,
      tearDown,
    });
    // Intentionally keyed only on bootstrapKey: one live socket per open
    // space identity. Token refresh flows through accessors on reconnect.
    onCleanup(stop);
  });

  return { room, transport };
}
