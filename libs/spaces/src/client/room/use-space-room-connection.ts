import type { ConfigService } from '@libs/auth/client/config-service-types';
import type { Kv } from '@pkgs/kv/interface';
import type {
  Room,
  RoomCommandPayload,
  RoomEvent,
  RoomState,
} from '@pkgs/room';
import type { WebSocketRoomTransport } from '@pkgs/room/client/adapters/transport/websocket';
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
import { createSpaceRoom } from './create-space-room';
import type { SpaceRoomConnectionBootstrap } from './space-room-connection-bootstrap';

type SpaceRoom = Room<RoomState, RoomCommandPayload, RoomEvent, string>;

function normalizeSessionToken(t: string | null): string | null {
  if (typeof t !== 'string') return null;
  const trimmed = t.trim();
  return trimmed.length === 0 ? null : trimmed;
}

const FRESH_TOKEN_TIMEOUT_MS = 4_000;

function raceFreshToken(
  getFresh: () => Promise<string | null>
): Promise<string | null> {
  return new Promise((resolve) => {
    let settled = false;
    const done = (v: string | null): void => {
      if (settled) return;
      settled = true;
      resolve(v);
    };
    const timer = setTimeout(() => done(null), FRESH_TOKEN_TIMEOUT_MS);
    void getFresh()
      .then((t) => {
        clearTimeout(timer);
        done(t);
      })
      .catch(() => {
        clearTimeout(timer);
        done(null);
      });
  });
}

function destroyRoomPair(args: {
  roomRef: MutableRefObject<SpaceRoom | null>;
  transportRef: MutableRefObject<WebSocketRoomTransport | null>;
  setRoom: Dispatch<SetStateAction<SpaceRoom | null>>;
  setTransport: Dispatch<SetStateAction<WebSocketRoomTransport | null>>;
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
  roomRef: MutableRefObject<SpaceRoom | null>;
  transportRef: MutableRefObject<WebSocketRoomTransport | null>;
  setRoom: Dispatch<SetStateAction<SpaceRoom | null>>;
  setTransport: Dispatch<SetStateAction<WebSocketRoomTransport | null>>;
  connectedKeyRef: MutableRefObject<string | null>;
  openingKeyRef: MutableRefObject<string | null>;
};

function commitOpenedRoom(
  args: OpenSpaceRoomArgs,
  nextRoom: SpaceRoom,
  nextTransport: WebSocketRoomTransport
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

function openSpaceRoom(args: OpenSpaceRoomArgs): () => void {
  let cancelled = false;
  void (async (): Promise<void> => {
    const { room: nextRoom, transport: nextTransport } = await createSpaceRoom({
      spaceId: args.bootstrap.spaceId,
      apiUrl: args.configService.getApiUrl(),
      module: args.module,
      kv: args.kv,
      myId: args.bootstrap.myId,
      installId: args.bootstrap.installId,
      clientId: args.bootstrap.clientId,
      getSessionToken: args.getSessionToken,
    });
    if (cancelled) {
      if (args.openingKeyRef.current === args.bootstrapKey) {
        args.openingKeyRef.current = null;
      }
      nextRoom.destroy();
      nextTransport.destroy();
      return;
    }
    commitOpenedRoom(args, nextRoom, nextTransport);
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
}): () => Promise<string | null> {
  return async () => {
    let fresh: string | null = null;
    try {
      fresh = await raceFreshToken(() => args.getFreshTokenRef.current());
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
  transport: WebSocketRoomTransport | null;
} {
  const { bootstrap, configService, kv, sessionToken, getFreshToken } = args;
  const [room, setRoom] = useState<SpaceRoom | null>(null);
  const [transport, setTransport] = useState<WebSocketRoomTransport | null>(
    null
  );
  const transportRef = useRef<WebSocketRoomTransport | null>(null);
  const roomRef = useRef<SpaceRoom | null>(null);
  const module = useSpaceModule();
  const sessionTokenRef = useRef(sessionToken);
  sessionTokenRef.current = sessionToken;
  const getFreshTokenRef = useRef(getFreshToken);
  getFreshTokenRef.current = getFreshToken;
  const connectedKeyRef = useRef<string | null>(null);
  const openingKeyRef = useRef<string | null>(null);

  const bootstrapKey =
    bootstrap === null
      ? null
      : `${bootstrap.spaceId}:${bootstrap.myId}:${bootstrap.installId}`;
  const hasBearer = normalizeSessionToken(sessionToken) !== null;
  const hasBearerOrAnon =
    hasBearer || (bootstrap !== null && bootstrap.myId.length > 0);

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
    if (bootstrap === null || bootstrapKey === null) return;
    return beginOpenSpaceRoom({
      bootstrap,
      bootstrapKey,
      configService,
      kv,
      module,
      hasBearerOrAnon,
      getSessionToken: makeGetSessionToken({
        getFreshTokenRef,
        sessionTokenRef,
      }),
      roomRef,
      transportRef,
      setRoom,
      setTransport,
      connectedKeyRef,
      openingKeyRef,
      tearDown,
    });
  }, [
    bootstrap,
    bootstrapKey,
    hasBearer,
    hasBearerOrAnon,
    configService,
    kv,
    module,
    tearDown,
  ]);

  return { room, roomRef, transport };
}
