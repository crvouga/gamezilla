import type {
  ClientTransport,
  ClientTransportHandlers,
} from '../client/core/transport';
import { ROOM_WIRE_KIND } from '../protocol/wire';
import type { RoomServer } from '../server/core/room-server';
import type { RoomCommandPayload, RoomEvent, RoomState } from '../types';

import type { RoomEdgeFaultController } from './edge-faults';
import type { SimRoomNetwork } from './network';
import type { SerialQueue } from './serial-queue';

export type SimLoopbackRoomTransportArgs<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
> = {
  /** Live server lookup — survives serverCrash/restart. */
  readonly getServer: () => RoomServer<S, C, E, string>;
  readonly connectionId: string;
  readonly identity: string;
  readonly clientKey: string;
  readonly network: SimRoomNetwork;
  readonly serverQueue: SerialQueue;
  readonly boundary?: RoomEdgeFaultController;
  /** Fired when a one-shot crash arm trips for this client. */
  readonly onBoundaryCrash?: (clientKey: string) => void;
};

function wireKind(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null) return null;
  if (!('kind' in payload)) return null;
  const kind = (payload as { kind: unknown }).kind;
  return typeof kind === 'string' ? kind : null;
}

/**
 * Loopback transport that routes C→S and S→C frames through {@link SimRoomNetwork}
 * so system scenarios can hold / partition / delay the link.
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
  private readonly getServer: () => RoomServer<S, C, E, string>;
  private readonly identity: string;
  private readonly clientKey: string;
  private readonly network: SimRoomNetwork;
  private readonly serverQueue: SerialQueue;
  private readonly boundary: RoomEdgeFaultController | undefined;
  private readonly onBoundaryCrash: ((clientKey: string) => void) | undefined;

  constructor(args: SimLoopbackRoomTransportArgs<S, C, E>) {
    this.getServer = args.getServer;
    this.connectionId = args.connectionId;
    this.identity = args.identity;
    this.clientKey = args.clientKey;
    this.network = args.network;
    this.serverQueue = args.serverQueue;
    this.boundary = args.boundary;
    this.onBoundaryCrash = args.onBoundaryCrash;
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
    const connectionId = this.connectionId;
    const identity = this.identity;
    this.network.sendToServer(this.clientKey, {
      connectionId,
      identity,
      payload,
    });
  }

  /**
   * Inject a client→server frame (bypasses Room.dispatch; still uses the net
   * mesh unless `direct` is true).
   */
  injectToServer(payload: unknown, opts?: { readonly direct?: boolean }): void {
    if (opts?.direct === true) {
      this.sendChain = this.sendChain
        .catch(() => undefined)
        .then(() =>
          this.serverQueue.enqueue(() =>
            this.getServer().handleClientMessage(
              this.connectionId,
              this.identity,
              payload
            )
          )
        );
      return;
    }
    this.sendJson(payload);
  }

  enqueueFromServer(payload: unknown): void {
    if (!this.linkUp) return;
    this.network.sendToClient(this.clientKey, payload);
  }

  /** Inject a server→client frame, bypassing the net mesh. */
  injectFromServer(payload: unknown): void {
    this.deliverToClientNow(payload);
  }

  deliverToClientNow(payload: unknown): void {
    this.maybeTripBoundary(payload);
    for (const h of [...this.handlers]) {
      h(payload);
    }
  }

  private maybeTripBoundary(payload: unknown): void {
    if (this.boundary === undefined) return;
    const kind = wireKind(payload);
    if (kind === ROOM_WIRE_KIND.welcome) {
      if (this.boundary.takeCrash(this.clientKey, 'afterNextWelcome')) {
        this.onBoundaryCrash?.(this.clientKey);
      }
    }
    if (kind === ROOM_WIRE_KIND.committed) {
      if (this.boundary.takeCrash(this.clientKey, 'afterNextCommitted')) {
        this.onBoundaryCrash?.(this.clientKey);
      }
      if (this.boundary.takeCrash(this.clientKey, 'afterNextCommandAck')) {
        this.onBoundaryCrash?.(this.clientKey);
      }
    }
    if (kind === ROOM_WIRE_KIND.rejected) {
      if (this.boundary.takeCrash(this.clientKey, 'afterNextCommandAck')) {
        this.onBoundaryCrash?.(this.clientKey);
      }
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
