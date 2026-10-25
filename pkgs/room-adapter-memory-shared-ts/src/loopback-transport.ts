import type {
  ClientTransport,
  ClientTransportHandlers,
} from '@pkgs/room-root-shared-ts/transport';
import type { RoomActor } from '@pkgs/room-root-shared-ts/types';
/**
 * Minimal server surface for in-process loopback. {@link RoomServer} satisfies
 * this without a client→server import (the `import-client-not-server` Biome rule).
 */
export type LoopbackRoomHost = {
  registerConnection(
    id: string,
    send: (payload: unknown) => void,
    actor: RoomActor,
    options?: { readonly silent?: boolean; readonly grants?: readonly string[] }
  ): void;
  unregisterConnection(id: string): void;
  handleClientMessage(
    connectionId: string,
    identity: string,
    raw: unknown
  ): Promise<void>;
};

export type LoopbackRoomTransportArgs = {
  readonly server: LoopbackRoomHost;
  readonly connectionId: string;
  readonly identity: string;
  readonly clientId: string;
  readonly grants?: readonly string[];
};

/**
 * In-process transport: `sendJson` runs the authoritative room host and
 * delivers server frames back to client subscribers.
 *
 * Outbound messages are serialized per transport instance so concurrent
 * `sendJson` calls cannot interleave server reduce/commit (matches WS
 * per-connection drain + room-server command chains).
 *
 * `connect` registers the connection; `destroy` unregisters it.
 */
export class LoopbackRoomTransport implements ClientTransport {
  private readonly handlers = new Set<(raw: unknown) => void>();
  private readonly handlerSets: ClientTransportHandlers[] = [];
  private sendChain: Promise<void> = Promise.resolve();
  private registered = false;
  opened = false;

  private readonly server: LoopbackRoomHost;
  private readonly connectionId: string;
  private readonly identity: string;
  private readonly clientId: string;
  private readonly grants: readonly string[];

  constructor(args: LoopbackRoomTransportArgs) {
    this.server = args.server;
    this.connectionId = args.connectionId;
    this.identity = args.identity;
    this.clientId = args.clientId;
    this.grants = args.grants ?? [];
  }

  get isConnected(): boolean {
    return this.opened;
  }

  async connect(): Promise<void> {
    if (!this.registered) {
      this.server.registerConnection(
        this.connectionId,
        (msg) => {
          this.deliverToClient(msg);
        },
        { id: this.identity, clientId: this.clientId },
        { grants: this.grants }
      );
      this.registered = true;
    }
    this.opened = true;
    for (const h of this.handlerSets) {
      h.onOpen?.();
    }
  }

  sendJson(payload: unknown): void {
    this.sendChain = this.sendChain
      .catch(() => undefined)
      .then(() =>
        this.server.handleClientMessage(
          this.connectionId,
          this.identity,
          payload
        )
      )
      .catch((err: unknown) => {
        for (const h of this.handlerSets) {
          h.onError?.(err instanceof Error ? err : new Error(String(err)));
        }
      });
  }

  /** Deterministically drains in-process delivery, including responses that enqueue more work. */
  async flush(): Promise<void> {
    let chain: Promise<void>;
    do {
      chain = this.sendChain;
      await chain;
    } while (chain !== this.sendChain);
  }

  /** Server → client (broadcast or unicast). */
  deliverToClient(payload: unknown): void {
    for (const h of this.handlers) {
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

  /** A server withdrawal closes the socket without destroying its client. */
  closeFromServer(): void {
    if (!this.registered) return;
    this.registered = false;
    this.opened = false;
    this.server.unregisterConnection(this.connectionId);
    for (const h of [...this.handlerSets]) h.onClose?.();
  }

  destroy(): void {
    if (this.registered) {
      this.server.unregisterConnection(this.connectionId);
      this.registered = false;
    }
    this.handlers.clear();
    this.handlerSets.length = 0;
    this.opened = false;
  }
}
