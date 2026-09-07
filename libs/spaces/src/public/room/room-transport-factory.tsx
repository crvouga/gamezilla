/**
 * Injectable room transport factory. Production defaults to WebSocket;
 * `@libs/sim` injects loopback.
 */
import type { Timers } from '@pkgs/clock';
import type { ClientTransport } from '@pkgs/room';
import { WebSocketRoomTransport } from '@pkgs/room-adapter-web';
import type { Random } from '@pkgs/uuid';
import { createContext, type JSX, useContext } from 'solid-js';

import { apiUrlToRoomWebSocketUrl } from './space-room-url';

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
