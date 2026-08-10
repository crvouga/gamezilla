import { Assert } from '@pkgs/assert';
import type { Timers } from '@pkgs/clock';
import type { Random } from '@pkgs/uuid';

import type {
  ClientTransport,
  ClientTransportHandlers,
} from '../../../core/transport';
import {
  clearHeartbeatTimers,
  type HeartbeatTimers,
  isPongWire,
  raceWithTimeout,
  sendPing,
  startHeartbeat,
} from './heartbeat';

const crash: Assert = Assert.crash();

export type WebSocketRoomTransportOptions = {
  /**
   * Static URL, or a factory invoked on every socket open (including
   * reconnects) so auth query params (e.g. `token`) can stay fresh.
   * May return a Promise when the caller needs to await token refresh.
   */
  url: string | (() => string | Promise<string>);
  reconnectBaseMs?: number;
  reconnectMaxMs?: number;
  /** Extra random delay (0..N ms) added to each reconnect. Default 250. */
  reconnectJitterMs?: number;
  /** Interval between liveness pings while the socket is open. Default 20s. */
  heartbeatMs?: number;
  /** Max wait for a pong after a ping before forced reconnect. Default 8s. */
  heartbeatTimeoutMs?: number;
  /** Max wait for the URL factory before scheduling a reconnect. Default 10s. */
  urlResolveTimeoutMs?: number;
  /** Injectable timers (required — no wall default). */
  timers: Timers;
  /** Injectable RNG for reconnect jitter (required — no wall default). */
  random: Random;
};

/**
 * Browser WebSocket transport with exponential backoff reconnect,
 * application-level heartbeat, and a foreground `probeLiveness` hook.
 */
export class WebSocketRoomTransport implements ClientTransport {
  private readonly urlOption: string | (() => string | Promise<string>);
  private readonly reconnectBaseMs: number;
  private readonly reconnectMaxMs: number;
  private readonly reconnectJitterMs: number;
  private readonly heartbeatMs: number;
  private readonly heartbeatTimeoutMs: number;
  private readonly urlResolveTimeoutMs: number;
  private readonly timers: Timers;
  private readonly random: Random;

  private socket: WebSocket | null = null;
  private reconnectAttempt = 0;
  private reconnectTimer: unknown | null = null;
  private destroyed = false;
  private openGeneration = 0;
  private lastResolvedUrl = '';
  private messageHandlers = new Set<(raw: unknown) => void>();
  private handlerSets: ClientTransportHandlers[] = [];
  private readonly heartbeat: HeartbeatTimers = {
    interval: null,
    timeout: null,
  };

  constructor(options: WebSocketRoomTransportOptions) {
    if (typeof options.url === 'string') {
      crash.nonEmptyString(options.url, 'WebSocketRoomTransport url required');
      this.lastResolvedUrl = options.url;
    }
    this.urlOption = options.url;
    this.reconnectBaseMs = options.reconnectBaseMs ?? 500;
    this.reconnectMaxMs = options.reconnectMaxMs ?? 30_000;
    this.reconnectJitterMs = options.reconnectJitterMs ?? 250;
    this.heartbeatMs = options.heartbeatMs ?? 20_000;
    this.heartbeatTimeoutMs = options.heartbeatTimeoutMs ?? 8_000;
    this.urlResolveTimeoutMs = options.urlResolveTimeoutMs ?? 10_000;
    this.timers = options.timers;
    this.random = options.random;
  }

  /** Most recently opened URL (useful for tests / diagnostics). */
  get url(): string {
    return this.lastResolvedUrl;
  }

  private async resolveUrl(): Promise<string> {
    const resolved =
      typeof this.urlOption === 'function'
        ? await raceWithTimeout(
            Promise.resolve(this.urlOption()),
            this.urlResolveTimeoutMs,
            'WebSocketRoomTransport url resolve',
            this.timers
          )
        : this.urlOption;
    crash.nonEmptyString(resolved, 'WebSocketRoomTransport url required');
    this.lastResolvedUrl = resolved;
    return resolved;
  }

  get isConnected(): boolean {
    if (typeof WebSocket === 'undefined') return false;
    return this.socket !== null && this.socket.readyState === WebSocket.OPEN;
  }

  connect(): void {
    if (this.destroyed) return;
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

  /**
   * Force an immediate reconnect (clears backoff). Used when the app returns
   * to the foreground and the socket may be a zombie.
   */
  reconnectNow(): void {
    if (this.destroyed) return;
    if (this.reconnectTimer !== null) {
      this.timers.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.reconnectAttempt = 0;
    this.openGeneration += 1;
    clearHeartbeatTimers(this.heartbeat, this.timers);
    if (this.socket !== null) {
      try {
        this.socket.close(1000, 'reconnect now');
      } catch {
        // already closing
      }
      this.socket = null;
    }
    this.openSocket();
  }

  /**
   * App-foreground liveness check: reconnect if disconnected; otherwise
   * send a ping and force reconnect if no pong arrives in time.
   */
  probeLiveness(): void {
    if (this.destroyed) return;
    if (!this.isConnected) {
      this.reconnectNow();
      return;
    }
    const s = this.socket;
    if (s === null) {
      this.reconnectNow();
      return;
    }
    try {
      sendPing(s);
    } catch {
      this.reconnectNow();
      return;
    }
    if (this.heartbeat.timeout !== null) {
      this.timers.clearTimeout(this.heartbeat.timeout);
    }
    this.heartbeat.timeout = this.timers.setTimeout(() => {
      this.heartbeat.timeout = null;
      if (!this.destroyed) this.reconnectNow();
    }, this.heartbeatTimeoutMs);
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.openGeneration += 1;
    clearHeartbeatTimers(this.heartbeat, this.timers);
    if (this.reconnectTimer !== null) {
      this.timers.clearTimeout(this.reconnectTimer);
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
    const generation = ++this.openGeneration;
    void (async () => {
      let resolved: string;
      try {
        resolved = await this.resolveUrl();
      } catch {
        if (!this.destroyed && generation === this.openGeneration) {
          this.scheduleReconnect();
        }
        return;
      }
      if (this.destroyed || generation !== this.openGeneration) return;
      this.attachSocket(resolved, generation);
    })();
  }

  private onHeartbeatMissed(generation: number): void {
    if (this.destroyed || generation !== this.openGeneration) return;
    clearHeartbeatTimers(this.heartbeat, this.timers);
    if (this.socket !== null) {
      try {
        this.socket.close(1000, 'heartbeat missed');
      } catch {
        // already closing
      }
      this.socket = null;
    }
    for (const h of this.handlerSets) {
      h.onClose?.();
    }
    this.reconnectAttempt = 0;
    this.scheduleReconnect();
  }

  private attachSocket(resolved: string, generation: number): void {
    if (this.destroyed || generation !== this.openGeneration) return;
    const ws = new WebSocket(resolved);
    this.socket = ws;

    ws.onopen = () => {
      if (this.destroyed || generation !== this.openGeneration) return;
      this.reconnectAttempt = 0;
      startHeartbeat({
        handles: this.heartbeat,
        timers: this.timers,
        getSocket: () => this.socket,
        heartbeatMs: this.heartbeatMs,
        heartbeatTimeoutMs: this.heartbeatTimeoutMs,
        onMissed: () => this.onHeartbeatMissed(generation),
      });
      for (const h of this.handlerSets) {
        h.onOpen?.();
      }
    };

    ws.onmessage = (ev: MessageEvent<string | ArrayBuffer>) => {
      if (this.destroyed || generation !== this.openGeneration) return;
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
      if (isPongWire(parsed)) {
        if (this.heartbeat.timeout !== null) {
          this.timers.clearTimeout(this.heartbeat.timeout);
          this.heartbeat.timeout = null;
        }
        return;
      }
      for (const h of [...this.messageHandlers]) {
        h(parsed);
      }
    };

    ws.onerror = () => {
      if (generation !== this.openGeneration) return;
      for (const h of this.handlerSets) {
        h.onError?.(new Error('WebSocket error'));
      }
    };

    ws.onclose = () => {
      if (this.destroyed || generation !== this.openGeneration) return;
      this.socket = null;
      clearHeartbeatTimers(this.heartbeat, this.timers);
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
    const jitter =
      this.reconnectJitterMs > 0
        ? Math.floor(this.random() * this.reconnectJitterMs)
        : 0;
    const delay = cap + jitter;
    this.reconnectTimer = this.timers.setTimeout(() => {
      this.reconnectTimer = null;
      if (this.destroyed) return;
      this.openSocket();
    }, delay);
  }
}
