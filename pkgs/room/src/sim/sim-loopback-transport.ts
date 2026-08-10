import type {
  ClientTransport,
  ClientTransportHandlers,
} from '../client/core/transport';
import type { RoomServer } from '../server/core/room-server';
import type { RoomCommandPayload, RoomEvent, RoomState } from '../types';

import type { SimRoomNetwork } from './network';
import type { SerialQueue } from './serial-queue';

export type SimLoopbackRoomTransportArgs<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
> = {
  readonly server: RoomServer<S, C, E, string>;
  readonly connectionId: string;
  readonly identity: string;
  readonly clientKey: string;
  readonly network: SimRoomNetwork;
  readonly serverQueue: SerialQueue;
};

/**
 * Loopback transport that routes C→S and S→C frames through {@link SimRoomNetwork}
 * so DST scenarios can hold / partition / delay the link.
 */
export class SimLoopbackRoomTransport<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
> implements ClientTransport
{
  private readonly handlers = new Set<(raw: unknown) => void>();
  private readonly handlerSets: ClientTransportHandlers[] = [];
  private sendChain: Promise<void> = Promise.resolve();
  opened = false;
  /** When false, C→S is dropped (local Room stays alive for offline dispatch). */
  private linkUp = true;
  private connectionId: string;
  private readonly server: RoomServer<S, C, E, string>;
  private readonly identity: string;
  private readonly clientKey: string;
  private readonly network: SimRoomNetwork;
  private readonly serverQueue: SerialQueue;

  constructor(args: SimLoopbackRoomTransportArgs<S, C, E>) {
    this.server = args.server;
    this.connectionId = args.connectionId;
    this.identity = args.identity;
    this.clientKey = args.clientKey;
    this.network = args.network;
    this.serverQueue = args.serverQueue;
  }

  setConnectionId(connectionId: string): void {
    this.connectionId = connectionId;
  }

  get isConnected(): boolean {
    return this.opened && this.linkUp;
  }

  flushSendChain(): Promise<void> {
    return this.sendChain.then(() => undefined);
  }

  async connect(): Promise<void> {
    this.opened = true;
    this.linkUp = true;
    for (const h of this.handlerSets) {
      h.onOpen?.();
    }
  }

  /**
   * Soft disconnect: Room stays mounted for offline dispatch; server session ends.
   */
  softDisconnect(): void {
    if (!this.linkUp && !this.opened) return;
    this.linkUp = false;
    this.opened = false;
    for (const h of this.handlerSets) {
      h.onClose?.();
    }
  }

  /** Soft reconnect after {@link softDisconnect} (caller re-registers on server). */
  softReconnect(): void {
    this.opened = true;
    this.linkUp = true;
    for (const h of this.handlerSets) {
      h.onOpen?.();
    }
  }

  sendJson(payload: unknown): void {
    if (!this.linkUp) return;
    this.network.enqueue(this.clientKey, () => {
      this.sendChain = this.sendChain
        .catch(() => undefined)
        .then(() =>
          this.serverQueue.enqueue(() =>
            this.server.handleClientMessage(
              this.connectionId,
              this.identity,
              payload
            )
          )
        )
        .catch((err: unknown) => {
          for (const h of this.handlerSets) {
            h.onError?.(err instanceof Error ? err : new Error(String(err)));
          }
        });
    });
  }

  enqueueFromServer(payload: unknown): void {
    if (!this.linkUp) return;
    this.network.enqueue(this.clientKey, () => {
      this.deliverToClientNow(payload);
    });
  }

  deliverToClientNow(payload: unknown): void {
    for (const h of [...this.handlers]) {
      h(payload);
    }
  }

  subscribe(handler: (raw: unknown) => void): () => void {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  onHandlers(h: ClientTransportHandlers): () => void {
    this.handlerSets.push(h);
    return () => {
      const i = this.handlerSets.indexOf(h);
      if (i >= 0) this.handlerSets.splice(i, 1);
    };
  }

  destroy(): void {
    this.handlers.clear();
    this.handlerSets.length = 0;
    this.opened = false;
    this.linkUp = false;
  }
}
