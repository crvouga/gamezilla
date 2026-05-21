import { Assert } from '@gamezilla/assert';

import type {
  ClientTransport,
  ClientTransportHandlers,
} from '../../../core/transport';

const crash: Assert = Assert.crash();

export type WebSocketRoomTransportOptions = {
  url: string;
  reconnectBaseMs?: number;
  reconnectMaxMs?: number;
};

/**
 * Browser WebSocket transport with exponential backoff reconnect.
 */
export class WebSocketRoomTransport implements ClientTransport {
  readonly url: string;
  private readonly reconnectBaseMs: number;
  private readonly reconnectMaxMs: number;

  private socket: WebSocket | null = null;
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private destroyed = false;
  private messageHandlers = new Set<(raw: unknown) => void>();
  private handlerSets: ClientTransportHandlers[] = [];
  constructor(options: WebSocketRoomTransportOptions) {
    crash.nonEmptyString(options.url, 'WebSocketRoomTransport url required');
    this.url = options.url;
    this.reconnectBaseMs = options.reconnectBaseMs ?? 500;
    this.reconnectMaxMs = options.reconnectMaxMs ?? 30_000;
  }

  get isConnected(): boolean {
    if (typeof WebSocket === 'undefined') return false;
    return this.socket !== null && this.socket.readyState === WebSocket.OPEN;
  }

  connect(): void {
    if (this.destroyed) {
      return;
    }
    if (typeof WebSocket === 'undefined') {
      throw new Error('WebSocket global is not available');
    }
    this.openSocket();
  }

  sendJson(payload: unknown): void {
    const s = this.socket;
    if (s === null || s.readyState !== WebSocket.OPEN) return;
    s.send(JSON.stringify(payload));
  }

  subscribe(handler: (raw: unknown) => void): () => void {
    this.messageHandlers.add(handler);
    return () => {
      this.messageHandlers.delete(handler);
    };
  }

  onHandlers(h: ClientTransportHandlers): () => void {
    this.handlerSets.push(h);
    return () => {
      this.handlerSets = this.handlerSets.filter((x) => x !== h);
    };
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.socket !== null) {
      this.socket.close(1000, 'transport destroyed');
      this.socket = null;
    }
    this.messageHandlers.clear();
    this.handlerSets = [];
  }

  private openSocket(): void {
    if (this.destroyed) return;
    const ws = new WebSocket(this.url);
    this.socket = ws;

    ws.onopen = () => {
      if (this.destroyed) return;
      this.reconnectAttempt = 0;
      for (const h of this.handlerSets) {
        h.onOpen?.();
      }
    };

    ws.onmessage = (ev: MessageEvent<string | ArrayBuffer>) => {
      if (this.destroyed) return;
      const raw =
        typeof ev.data === 'string'
          ? ev.data
          : new TextDecoder().decode(ev.data as ArrayBuffer);
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw) as unknown;
      } catch {
        return;
      }
      for (const h of [...this.messageHandlers]) {
        h(parsed);
      }
    };

    ws.onerror = () => {
      for (const h of this.handlerSets) {
        h.onError?.(new Error('WebSocket error'));
      }
    };

    ws.onclose = () => {
      if (this.destroyed) return;
      this.socket = null;
      for (const h of this.handlerSets) {
        h.onClose?.();
      }
      this.scheduleReconnect();
    };
  }

  private scheduleReconnect(): void {
    if (this.destroyed) return;
    if (this.reconnectTimer !== null) return;
    const attempt = this.reconnectAttempt++;
    const cap = Math.min(
      this.reconnectMaxMs,
      this.reconnectBaseMs * 2 ** Math.min(attempt, 10)
    );
    const jitter = Math.floor(Math.random() * 250);
    const delay = cap + jitter;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.destroyed) return;
      this.openSocket();
    }, delay);
  }
}
