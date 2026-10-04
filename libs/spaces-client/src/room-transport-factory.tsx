/**
 * Injectable room transport factory. Production defaults to WebSocket;
 * `@libs/harness` injects loopback.
 */

import { apiUrlToRoomWebSocketUrl } from '@libs/spaces-shared/space-room-url';
import type { Timers } from '@pkgs/clock-shared/types';
import { WebSocketRoomTransport } from '@pkgs/room-adapter-web-shared/websocket-transport';
import type { ClientTransport } from '@pkgs/room-shared/transport';
import type { Random } from '@pkgs/uuid-shared/create-id';
import { createContext, type JSX, useContext } from 'solid-js';

export type CreateRoomTransportArgs = {
  readonly spaceId: string;
  readonly apiUrl: string;
  /** Member actor id (`accountId ?? deviceId`) — room identity + roster. */
  readonly identity: string;
  readonly installId: string;
  readonly clientId: string;
  readonly getSessionToken: () => string | null | Promise<string | null>;
  readonly timers: Timers;
  readonly random: Random;
};

export type CreateRoomTransport = (
  args: CreateRoomTransportArgs
) => ClientTransport;

export class WebSocketRoomTransportFactory {
  constructor(
    private readonly timers: Timers,
    private readonly random: Random
  ) {}

  create(
    args: Omit<CreateRoomTransportArgs, 'timers' | 'random'>
  ): ClientTransport {
    const topic = `space:${args.spaceId}`;
    return new WebSocketRoomTransport({
      timers: this.timers,
      random: this.random,
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
}

function defaultCreateTransport(
  args: CreateRoomTransportArgs
): ClientTransport {
  return new WebSocketRoomTransportFactory(args.timers, args.random).create(
    args
  );
}

const Ctx = createContext<CreateRoomTransport | null>(null);

export function RoomTransportFactoryProvider(props: {
  readonly children: JSX.Element;
  readonly createTransport?: CreateRoomTransport | undefined;
}): JSX.Element {
  return (
    <Ctx.Provider value={props.createTransport ?? defaultCreateTransport}>
      {props.children}
    </Ctx.Provider>
  );
}

export function useCreateRoomTransport(): CreateRoomTransport {
  return useContext(Ctx) ?? defaultCreateTransport;
}
