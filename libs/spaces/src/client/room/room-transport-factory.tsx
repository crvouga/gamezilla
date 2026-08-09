/**
 * Injectable room transport factory. Production defaults to WebSocket;
 * `@libs/sim` injects loopback.
 */
import type { Timers } from '@pkgs/clock';
import type { ClientTransport } from '@pkgs/room';
import { WebSocketRoomTransport } from '@pkgs/room/client/adapters/transport/websocket';
import type { Random } from '@pkgs/uuid';
import { createContext, type ReactNode, useContext, useMemo } from 'react';

import { apiUrlToRoomWebSocketUrl } from './space-room-url';

export type CreateRoomTransportArgs = {
  readonly spaceId: string;
  readonly apiUrl: string;
  readonly installId: string;
  readonly clientId: string;
  readonly getSessionToken: () => string | null | Promise<string | null>;
  readonly timers: Timers;
  readonly random: Random;
};

export type CreateRoomTransport = (
  args: CreateRoomTransportArgs
) => ClientTransport;

export function createWebSocketRoomTransport(
  args: CreateRoomTransportArgs
): ClientTransport {
  const topic = `space:${args.spaceId}`;
  return new WebSocketRoomTransport({
    timers: args.timers,
    random: args.random,
    url: async () => {
      const token = await Promise.resolve(args.getSessionToken());
      return apiUrlToRoomWebSocketUrl({
        apiUrl: args.apiUrl,
        topic,
        sessionToken: token,
        installId: args.installId,
        clientId: args.clientId,
      });
    },
  });
}

const Ctx = createContext<CreateRoomTransport | null>(null);

export function RoomTransportFactoryProvider({
  children,
  createTransport,
}: {
  readonly children: ReactNode;
  readonly createTransport?: CreateRoomTransport;
}): ReactNode {
  const value = useMemo(
    () => createTransport ?? createWebSocketRoomTransport,
    [createTransport]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCreateRoomTransport(): CreateRoomTransport {
  const v = useContext(Ctx);
  return v ?? createWebSocketRoomTransport;
}
