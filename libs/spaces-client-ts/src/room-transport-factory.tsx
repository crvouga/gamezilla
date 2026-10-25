/**
 * Injectable room transport factory. Production defaults to WebSocket;
 * `@libs/harness-ts` injects loopback.
 */

import { apiUrlToRoomWebSocketUrl } from '@libs/spaces-shared-ts/space-room-url';
import type { Clock, Timers } from '@pkgs/clock-shared-ts/types';
import { WebSocketRoomTransport } from '@pkgs/room-adapter-web-shared-ts/websocket-transport';
import type { ClientTransport } from '@pkgs/room-root-shared-ts/transport';
import type { Random } from '@pkgs/uuid-shared-ts/create-id';
import { createContext, type JSX, useContext } from 'solid-js';
import { roomRoundTrip } from './room-transport-measures';

export type CreateRoomTransportArgs = {
  readonly topic: string;
  readonly module: string;
  readonly apiUrl: string;
  /** Member actor id (`accountId ?? deviceId`) — room identity + roster. */
  readonly identity: string;
  readonly installId: string;
  readonly clientId: string;
  readonly getSessionToken: () => string | null | Promise<string | null>;
  readonly clock: Clock;
  readonly timers: Timers;
  readonly random: Random;
};

export type CreateRoomTransport = (
  args: CreateRoomTransportArgs
) => ClientTransport;

export class WebSocketRoomTransportFactory {
  constructor(
    private readonly clock: Clock,
    private readonly timers: Timers,
    private readonly random: Random
  ) {}

  create(
    args: Omit<CreateRoomTransportArgs, 'clock' | 'timers' | 'random'>
  ): ClientTransport {
    const topic = args.topic;
    return new WebSocketRoomTransport({
      clock: this.clock,
      timers: this.timers,
      random: this.random,
      onRoundTrip: roomRoundTrip,
      url: async () => {
        const token = await Promise.resolve(args.getSessionToken());
        return apiUrlToRoomWebSocketUrl({
          apiUrl: args.apiUrl,
          topic,
          module: args.module,
          sessionToken: token,
          installId: args.installId,
          clientId: args.clientId,
        });
      },
    });
  }
}

const Ctx = createContext<CreateRoomTransport | null>(null);

export function RoomTransportFactoryProvider(props: {
  readonly children: JSX.Element;
  readonly createTransport: CreateRoomTransport;
}): JSX.Element {
  return (
    <Ctx.Provider value={props.createTransport}>{props.children}</Ctx.Provider>
  );
}

export function useCreateRoomTransport(): CreateRoomTransport {
  const createTransport = useContext(Ctx);
  if (createTransport === null) {
    throw new Error('RoomTransportFactoryProvider is required');
  }
  return createTransport;
}
