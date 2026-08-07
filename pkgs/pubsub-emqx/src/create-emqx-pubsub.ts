import {
  assertValidTopic,
  decodePayload,
  encodePayload,
  type PubSub,
  PubSubClosedError,
  type PubSubStatus,
  type Topic,
} from '@pkgs/pubsub/interface';
import mqtt, { type IClientOptions, type MqttClient } from 'mqtt';
import { rememberEmqxClientId } from './emqx-client-id';
import { fullJitterDelayMs } from './reconnect-backoff';

type Handler = (data: unknown) => void;
type AuthFn = () => Promise<{ username: string; password: string }>;
type ConnectFn = (url: string, opts: IClientOptions) => MqttClient;

/** MQTT QoS for publish + subscribe (offline session queue requires ≥1). */
export const EMQX_PUBSUB_QOS = 1 as const;

/** Broker keeps the session (subscriptions + mqueue) this long after disconnect. */
export const EMQX_SESSION_EXPIRY_SEC = 600;

export type EmqxPubSubOptions = {
  url: string;
  auth: AuthFn;
  /**
   * Stable MQTT client id for this device / instance. Reused across reconnects
   * so the broker can drain the offline session queue. One live connection per
   * id — a second connect with the same id kicks the older session.
   */
  clientIdPrefix: string;
  reconnect?: { baseMs?: number; maxMs?: number };
  keepaliveSec?: number;
  /** Injectable for unit tests. Defaults to `mqtt.connect`. */
  connectFn?: ConnectFn;
};

export function createEmqxPubSub(options: EmqxPubSubOptions): PubSub {
  return new EmqxMqttPubSub(options);
}

class EmqxMqttPubSub implements PubSub {
  private readonly url: string;
  private readonly auth: AuthFn;
  private readonly clientId: string;
  private readonly baseMs: number;
  private readonly maxMs: number;
  private readonly keepaliveSec: number;
  private readonly connectFn: ConnectFn;

  private client: MqttClient | null = null;
  private currentStatus: PubSubStatus = 'connecting';
  private closed = false;
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly topics = new Map<Topic, Set<Handler>>();
  private readonly statusListeners = new Set<(s: PubSubStatus) => void>();
  private connectWaiters = new Set<() => void>();

  constructor(options: EmqxPubSubOptions) {
    this.url = options.url;
    this.auth = options.auth;
    this.clientId = options.clientIdPrefix;
    this.baseMs = options.reconnect?.baseMs ?? 500;
    this.maxMs = options.reconnect?.maxMs ?? 30_000;
    this.keepaliveSec = options.keepaliveSec ?? 30;
    this.connectFn = options.connectFn ?? mqtt.connect;
    rememberEmqxClientId(this, this.clientId);
    void this.openConnection();
  }

  async publish(topic: Topic, data: unknown): Promise<void> {
    this.assertOpen();
    assertValidTopic(topic);
    const payload = encodePayload(data);
    await this.waitUntilConnected();
    const client = this.requireClient();
    await publishQos1(client, topic, payload);
  }

  subscribe(topic: Topic, handler: Handler): () => void {
    this.assertOpen();
    assertValidTopic(topic);
    let set = this.topics.get(topic);
    const isFirst = !set;
    if (!set) {
      set = new Set();
      this.topics.set(topic, set);
    }
    set.add(handler);
    if (isFirst && this.client?.connected) {
      this.client.subscribe(topic, { qos: EMQX_PUBSUB_QOS });
    }
    return () => this.unsubscribeHandler(topic, handler);
  }

  status(): PubSubStatus {
    return this.closed ? 'down' : this.currentStatus;
  }

  onStatus(cb: (s: PubSubStatus) => void): () => void {
    if (this.closed) return () => undefined;
    this.statusListeners.add(cb);
    return () => {
      this.statusListeners.delete(cb);
    };
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.clearReconnectTimer();
    this.topics.clear();
    this.statusListeners.clear();
    this.setStatus('down');
    const client = this.client;
    this.client = null;
    // Discard the broker session so we do not leave an orphan mqueue.
    client?.end(false, {
      reasonCode: 0,
      properties: { sessionExpiryInterval: 0 },
    });
    this.flushConnectWaiters();
  }

  private unsubscribeHandler(topic: Topic, handler: Handler): void {
    const set = this.topics.get(topic);
    if (!set) return;
    set.delete(handler);
    if (set.size > 0) return;
    this.topics.delete(topic);
    if (this.client?.connected) {
      this.client.unsubscribe(topic);
    }
  }

  private async openConnection(): Promise<void> {
    if (this.closed) return;
    this.setStatus('connecting');
    try {
      const creds = await this.auth();
      if (this.closed) return;
      const client = this.connectFn(this.url, {
        clientId: this.clientId,
        username: creds.username,
        password: creds.password,
        // MQTT 5 cleanStart=false — resume session + drain offline mqueue.
        clean: false,
        reconnectPeriod: 0,
        keepalive: this.keepaliveSec,
        protocolVersion: 5,
        properties: {
          sessionExpiryInterval: EMQX_SESSION_EXPIRY_SEC,
        },
      });
      this.client = client;
      this.wireClient(client);
    } catch (err) {
      console.warn('[pubsub-emqx] connect failed', err);
      this.setStatus('down');
      this.scheduleReconnect();
    }
  }

  private wireClient(client: MqttClient): void {
    client.on('connect', () => {
      if (this.closed || this.client !== client) return;
      this.reconnectAttempt = 0;
      this.setStatus('connected');
      // Broker may already hold subscriptions; re-SUBSCRIBE keeps app + broker aligned.
      this.resubscribeAll(client);
      this.flushConnectWaiters();
    });
    client.on('close', () => {
      if (this.closed || this.client !== client) return;
      this.setStatus('down');
      this.scheduleReconnect();
    });
    client.on('offline', () => {
      if (this.closed || this.client !== client) return;
      this.setStatus('down');
    });
    client.on('message', (topic, buf) => {
      this.dispatchMessage(topic, buf.toString('utf8'));
    });
    client.on('error', (err) => {
      console.warn('[pubsub-emqx] mqtt error', err);
    });
  }

  private resubscribeAll(client: MqttClient): void {
    for (const topic of this.topics.keys()) {
      client.subscribe(topic, { qos: EMQX_PUBSUB_QOS });
    }
  }

  private dispatchMessage(topic: string, raw: string): void {
    const data = decodePayload(raw);
    if (data === undefined) return;
    const set = this.topics.get(topic);
    if (!set) return;
    for (const handler of [...set]) {
      try {
        handler(data);
      } catch (err) {
        console.warn('[pubsub] handler error contained', err);
      }
    }
  }

  private scheduleReconnect(): void {
    if (this.closed || this.reconnectTimer) return;
    const delay = fullJitterDelayMs(
      this.reconnectAttempt,
      this.baseMs,
      this.maxMs
    );
    this.reconnectAttempt += 1;
    this.setStatus('connecting');
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      const old = this.client;
      this.client = null;
      // Force-drop the socket without clearing sessionExpiry (no DISCONNECT expiry 0).
      old?.end(true);
      void this.openConnection();
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (!this.reconnectTimer) return;
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  private setStatus(next: PubSubStatus): void {
    if (this.currentStatus === next) return;
    this.currentStatus = next;
    for (const cb of [...this.statusListeners]) {
      try {
        cb(next);
      } catch (err) {
        console.warn('[pubsub-emqx] onStatus error contained', err);
      }
    }
  }

  private waitUntilConnected(): Promise<void> {
    if (this.closed) return Promise.reject(new PubSubClosedError());
    if (this.client?.connected) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const finish = () => {
        this.connectWaiters.delete(finish);
        if (this.closed) reject(new PubSubClosedError());
        else resolve();
      };
      this.connectWaiters.add(finish);
    });
  }

  private flushConnectWaiters(): void {
    for (const w of [...this.connectWaiters]) w();
    this.connectWaiters.clear();
  }

  private requireClient(): MqttClient {
    if (!this.client?.connected) {
      throw new Error('PubSub MQTT client is not connected');
    }
    return this.client;
  }

  private assertOpen(): void {
    if (this.closed) throw new PubSubClosedError();
  }
}

function publishQos1(
  client: MqttClient,
  topic: string,
  payload: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    client.publish(
      topic,
      payload,
      { qos: EMQX_PUBSUB_QOS, retain: false },
      (err) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });
}
