import { Assert } from '@gamezilla/lib/assert';
import type { Transport, TransportMessageContext } from './transport-types';

const crash: Assert = Assert.crash();

export type WebSocketRoomTransportOptions = {
  /** Full WebSocket URL (e.g. `wss://api.example.com/room/ws?topic=...`). */
  url: string;
  /** Room topic; must match {@link Room} `topic` (used only for subscribe/publish arity). */
  topic: string;
  /** Initial reconnect delay in ms (default 500). */
  reconnectBaseMs?: number;
  /** Max reconnect delay in ms (default 30_000). */
  reconnectMaxMs?: number;
};

type Subscriber = (payload: unknown, context?: TransportMessageContext) => void;

/**
 * `Transport` backed by a browser / RN `WebSocket`, for real multi-device sync
 * via a relay (e.g. Cloudflare Durable Object).
 */
export class WebSocketRoomTransport implements Transport {
  readonly topic: string;
  private readonly url: string;
  private readonly reconnectBaseMs: number;
  private readonly reconnectMaxMs: number;

  private socket: WebSocket | null = null;
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private is_destroyed = false;
  private readonly subscribers = new Map<string, Set<Subscriber>>();
  private readonly connectHandlers = new Set<() => void>();

  constructor(options: WebSocketRoomTransportOptions) {
    crash.nonEmptyString(options.url, 'WebSocketRoomTransport url must be non-empty');
    crash.nonEmptyString(options.topic, 'WebSocketRoomTransport topic must be non-empty');
    this.url = options.url;
    this.topic = options.topic;
    this.reconnectBaseMs = options.reconnectBaseMs ?? 500;
    this.reconnectMaxMs = options.reconnectMaxMs ?? 30_000;
    this.openSocket();
  }

  publish(topic: string, payload: unknown, _options?: { qos?: 0 | 1 }): void {
    void _options;
    crash.ok(!this.is_destroyed, 'cannot publish on destroyed WebSocketRoomTransport');
    crash.nonEmptyString(topic, 'topic must be non-empty string');
    const s = this.socket;
    const OPEN = typeof WebSocket !== 'undefined' ? WebSocket.OPEN : 1;
    if (s === null || s.readyState !== OPEN) {
      return;
    }
    const text = JSON.stringify(payload);
    s.send(text);
  }

  subscribe(
    topic: string,
    handler: (payload: unknown, context?: TransportMessageContext) => void
  ): () => void {
    crash.ok(!this.is_destroyed, 'cannot subscribe on destroyed WebSocketRoomTransport');
    crash.nonEmptyString(topic, 'topic must be non-empty string');
    crash.ok(typeof handler === 'function', 'handler must be a function');
    if (!this.subscribers.has(topic)) {
      this.subscribers.set(topic, new Set());
    }
    const set = this.subscribers.get(topic)!;
    set.add(handler);
    return () => {
      set.delete(handler);
      if (set.size === 0) this.subscribers.delete(topic);
    };
  }

  onConnect(handler: () => void): () => void {
    crash.ok(!this.is_destroyed, 'cannot onConnect on destroyed WebSocketRoomTransport');
    crash.ok(typeof handler === 'function', 'handler must be a function');
    this.connectHandlers.add(handler);
    return () => {
      this.connectHandlers.delete(handler);
    };
  }

  destroy(): void {
    if (this.is_destroyed) return;
    this.is_destroyed = true;
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.socket !== null) {
      this.socket.close(1000, 'transport destroyed');
      this.socket = null;
    }
    this.subscribers.clear();
    this.connectHandlers.clear();
  }

  private openSocket(): void {
    if (this.is_destroyed) return;
    if (typeof WebSocket === 'undefined') {
      crash.fail('WebSocket global is not available');
    }
    const ws = new WebSocket(this.url);
    this.socket = ws;

    ws.onopen = () => {
      if (this.is_destroyed) return;
      this.reconnectAttempt = 0;
      for (const h of [...this.connectHandlers]) {
        h();
      }
    };

    ws.onmessage = (ev: MessageEvent<string | ArrayBuffer>) => {
      if (this.is_destroyed) return;
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
      const handlers = this.subscribers.get(this.topic);
      if (!handlers) return;
      for (const h of [...handlers]) {
        h(parsed, undefined);
      }
    };

    ws.onerror = () => {
      // reconnect scheduled from onclose
    };

    ws.onclose = () => {
      if (this.is_destroyed) return;
      this.socket = null;
      this.scheduleReconnect();
    };
  }

  private scheduleReconnect(): void {
    if (this.is_destroyed) return;
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
      if (this.is_destroyed) return;
      this.openSocket();
    }, delay);
  }
}
