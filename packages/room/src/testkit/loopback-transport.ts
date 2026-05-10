import type {
  ClientTransport,
  ClientTransportHandlers,
} from '../client/core/transport';
import type { RoomServer } from '../server/core/room-server';
import type { RoomCommandPayload, RoomEvent, RoomState } from '../types';

/**
 * In-process transport: `sendJson` runs the authoritative {@link RoomServer} and
 * delivers server frames back to client subscribers.
 */
export class LoopbackRoomTransport<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
> implements ClientTransport {
  private readonly handlers = new Set<(raw: unknown) => void>();
  private readonly handlerSets: ClientTransportHandlers[] = [];
  opened = false;

  constructor(
    private readonly server: RoomServer<S, C, E, string>,
    private readonly connectionId: string,
    private readonly identity: string
  ) {}

  get isConnected(): boolean {
    return this.opened;
  }

  async connect(): Promise<void> {
    this.opened = true;
    for (const h of this.handlerSets) {
      h.onOpen?.();
    }
  }

  sendJson(payload: unknown): void {
    void this.server
      .handleClientMessage(this.connectionId, this.identity, payload)
      .catch((err: unknown) => {
        for (const h of this.handlerSets) {
          h.onError?.(err instanceof Error ? err : new Error(String(err)));
        }
      });
  }

  /** Server → client (broadcast or unicast). */
  deliverToClient(payload: unknown): void {
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
  }
}
