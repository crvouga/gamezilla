import type { ConfigService } from '@libs/auth/client/config-service-types';
import type { Timers } from '@pkgs/clock';
import type { Io } from '@pkgs/io';
import { useIo } from '@pkgs/io';
import type { Kv } from '@pkgs/kv/interface';
import type {
  ClientTransport,
  Room,
  RoomCommandPayload,
  RoomEvent,
  RoomState,
} from '@pkgs/room';
import {
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useSpaceModule } from '../module/space-module-context';
import {
  type CreateSpaceRoomResult,
  createSpaceRoom,
} from './create-space-room';
import { useCreateRoomTransport } from './room-transport-factory';
import type { SpaceRoomConnectionBootstrap } from './space-room-connection-bootstrap';

type SpaceRoom = Room<RoomState, RoomCommandPayload, RoomEvent, string>;

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

function destroyRoomPair(args: {
  roomRef: MutableRefObject<SpaceRoom | null>;
  transportRef: MutableRefObject<ClientTransport | null>;
  setRoom: Dispatch<SetStateAction<SpaceRoom | null>>;
  setTransport: Dispatch<SetStateAction<ClientTransport | null>>;
}): void {
  const room = args.roomRef.current;
  const transport = args.transportRef.current;
  args.roomRef.current = null;
  args.transportRef.current = null;
  args.setRoom(null);
  args.setTransport(null);
  room?.destroy();
  transport?.destroy();
}

type OpenSpaceRoomArgs = {
  bootstrap: SpaceRoomConnectionBootstrap;
  bootstrapKey: string;
  configService: ConfigService;
  kv: Kv;
  module: ReturnType<typeof useSpaceModule>;
  getSessionToken: () => string | null | Promise<string | null>;
  createTransport: ReturnType<typeof useCreateRoomTransport>;
  io: Io;
  roomRef: MutableRefObject<SpaceRoom | null>;
  transportRef: MutableRefObject<ClientTransport | null>;
  setRoom: Dispatch<SetStateAction<SpaceRoom | null>>;
  setTransport: Dispatch<SetStateAction<ClientTransport | null>>;
  connectedKeyRef: MutableRefObject<string | null>;
  openingKeyRef: MutableRefObject<string | null>;
};

function commitOpenedRoom(
  args: OpenSpaceRoomArgs,
  nextRoom: SpaceRoom,
  nextTransport: ClientTransport
): void {
  const prevRoom = args.roomRef.current;
  const prevTransport = args.transportRef.current;
  args.roomRef.current = nextRoom;
  args.transportRef.current = nextTransport;
  args.connectedKeyRef.current = args.bootstrapKey;
  args.openingKeyRef.current = null;
  args.setRoom(nextRoom);
  args.setTransport(nextTransport);
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
      opened = await createSpaceRoom({
        spaceId: args.bootstrap.spaceId,
        apiUrl: args.configService.getApiUrl(),
        module: args.module,
        kv: args.kv,
        myId: args.bootstrap.myId,
        installId: args.bootstrap.installId,
        clientId: args.bootstrap.clientId,
        getSessionToken: args.getSessionToken,
        createTransport: args.createTransport,
        io: args.io,
      });
    } catch {
      // Room.open is hardened to avoid this; if it still throws, clear the
      // latch so a later bootstrap key change / remount can retry.
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
    tearDown: () => void;
    hasBearerOrAnon: boolean;
  }
): () => void {
  if (
    shouldSkipOpen({
      bootstrapKey: args.bootstrapKey,
      hasBearerOrAnon: args.hasBearerOrAnon,
      connectedKey: args.connectedKeyRef.current,
      currentRoom: args.roomRef.current,
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

function makeGetSessionToken(args: {
  getFreshTokenRef: MutableRefObject<() => Promise<string | null>>;
  sessionTokenRef: MutableRefObject<string | null>;
  timersRef: MutableRefObject<Timers>;
}): () => Promise<string | null> {
  return async () => {
    let fresh: string | null = null;
    try {
      fresh = await raceFreshToken(args.timersRef.current, () =>
        args.getFreshTokenRef.current()
      );
    } catch {
      fresh = null;
    }
    return normalizeSessionToken(fresh ?? args.sessionTokenRef.current);
  };
}

export type UseSpaceRoomConnectionArgs = {
  bootstrap: SpaceRoomConnectionBootstrap | null;
  configService: ConfigService;
  kv: Kv;
  /** Bearer for `/room`; re-run when bearer availability changes, not on JWT rotation. */
  sessionToken: string | null;
  /** Async refresh used on every socket open so reconnects do not reuse a stale JWT. */
  getFreshToken: () => Promise<string | null>;
};

export function useSpaceRoomConnection(args: UseSpaceRoomConnectionArgs): {
  room: SpaceRoom | null;
  roomRef: MutableRefObject<SpaceRoom | null>;
  transport: ClientTransport | null;
} {
  const { bootstrap, configService, kv, sessionToken, getFreshToken } = args;
  const [room, setRoom] = useState<SpaceRoom | null>(null);
  const [transport, setTransport] = useState<ClientTransport | null>(null);
  const transportRef = useRef<ClientTransport | null>(null);
  const roomRef = useRef<SpaceRoom | null>(null);
  const module = useSpaceModule();
  const createTransport = useCreateRoomTransport();
  const io = useIo();
  const sessionTokenRef = useRef(sessionToken);
  sessionTokenRef.current = sessionToken;
  const getFreshTokenRef = useRef(getFreshToken);
  getFreshTokenRef.current = getFreshToken;
  const timersRef = useRef(io.timers);
  timersRef.current = io.timers;
  const ioRef = useRef(io);
  ioRef.current = io;
  const createTransportRef = useRef(createTransport);
  createTransportRef.current = createTransport;
  const connectedKeyRef = useRef<string | null>(null);
  const openingKeyRef = useRef<string | null>(null);

  const bootstrapKey =
    bootstrap === null
      ? null
      : `${bootstrap.spaceId}:${bootstrap.myId}:${bootstrap.installId}:${bootstrap.clientId}`;
  const hasBearer = normalizeSessionToken(sessionToken) !== null;
  const hasBearerOrAnon =
    hasBearer || (bootstrap !== null && bootstrap.myId.length > 0);

  // Keep open args off the effect dep list so JWT/token/provider identity
  // churn cannot destroy+recreate the WebSocket.
  const bootstrapRef = useRef(bootstrap);
  bootstrapRef.current = bootstrap;
  const configServiceRef = useRef(configService);
  configServiceRef.current = configService;
  const kvRef = useRef(kv);
  kvRef.current = kv;
  const moduleRef = useRef(module);
  moduleRef.current = module;
  const hasBearerOrAnonRef = useRef(hasBearerOrAnon);
  hasBearerOrAnonRef.current = hasBearerOrAnon;

  const tearDown = useCallback(() => {
    connectedKeyRef.current = null;
    openingKeyRef.current = null;
    destroyRoomPair({ roomRef, transportRef, setRoom, setTransport });
  }, []);

  useEffect(() => {
    if (bootstrapKey !== null) return;
    tearDown();
  }, [bootstrapKey, tearDown]);

  useEffect(() => {
    const current = bootstrapRef.current;
    if (current === null || bootstrapKey === null) return;
    return beginOpenSpaceRoom({
      bootstrap: current,
      bootstrapKey,
      configService: configServiceRef.current,
      kv: kvRef.current,
      module: moduleRef.current,
      hasBearerOrAnon: hasBearerOrAnonRef.current,
      getSessionToken: makeGetSessionToken({
        getFreshTokenRef,
        sessionTokenRef,
        timersRef,
      }),
      createTransport: createTransportRef.current,
      io: ioRef.current,
      roomRef,
      transportRef,
      setRoom,
      setTransport,
      connectedKeyRef,
      openingKeyRef,
      tearDown,
    });
    // Intentionally keyed only on bootstrapKey: one live socket per open
    // space identity. Token refresh is via refs + URL factory on reconnect.
  }, [bootstrapKey, tearDown]);

  return { room, roomRef, transport };
}
