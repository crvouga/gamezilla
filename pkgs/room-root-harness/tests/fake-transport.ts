import type {
  ClientTransport,
  ClientTransportHandlers,
} from '@pkgs/room-root-shared/transport';

/**
 * Minimal in-process transport: frames sent by the client go to `onSend`;
 * `deliver` pushes a server frame into the client synchronously.
 */
export class FakeTransport implements ClientTransport {
  readonly sent: unknown[] = [];
  private readonly handlers = new Set<(raw: unknown) => void>();
  private readonly lifecycle: ClientTransportHandlers[] = [];
  connected = false;
  onSend: ((payload: unknown) => void) | null = null;

  get isConnected(): boolean {
    return this.connected;
  }

  connect(): void {
    this.connected = true;
    for (const h of this.lifecycle) h.onOpen?.();
  }

  close(): void {
    this.connected = false;
    for (const h of this.lifecycle) h.onClose?.();
  }

  sendJson(payload: unknown): void {
    this.sent.push(payload);
    this.onSend?.(payload);
  }

  deliver(raw: unknown): void {
    for (const h of this.handlers) h(raw);
  }

  subscribe(handler: (raw: unknown) => void): () => void {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  onHandlers(h: ClientTransportHandlers): () => void {
    this.lifecycle.push(h);
    return () => {
      const i = this.lifecycle.indexOf(h);
      if (i >= 0) this.lifecycle.splice(i, 1);
    };
  }

  destroy(): void {
    this.connected = false;
    this.handlers.clear();
    this.lifecycle.length = 0;
  }
}
