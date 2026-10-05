import type { Timers } from '@pkgs/clock-shared/types';
import type { Logger } from '@pkgs/logger-shared/logger';
import type { PubSub, PubSubStatus } from '@pkgs/pubsub-root-shared/interface';
import { decodePayload, encodePayload } from '@pkgs/pubsub-root-shared/payload';
import { PubSubClosedError } from '@pkgs/pubsub-root-shared/pubsub-closed-error';
import { PubSubPublishError } from '@pkgs/pubsub-root-shared/pubsub-publish-error';
import type { Topic } from '@pkgs/pubsub-root-shared/topic';
import { assertValidTopic } from '@pkgs/pubsub-root-shared/topic';
import mqtt, { type IClientOptions, type MqttClient } from 'mqtt';
import { rememberMqttClientId } from './mqtt-client-id';
import { fullJitterDelayMs } from './reconnect-backoff';

type Handler = (data: unknown) => void;

export type MqttAuthFn = () => Promise<{
  username: string;
  password: string;
}>;

export type MqttConnectFn = (url: string, opts: IClientOptions) => MqttClient;

/** MQTT QoS for publish + subscribe (offline session queues require QoS 1+). */
export const MQTT_PUBSUB_QOS = 1 as const;

/** Broker session lifetime after disconnect, in seconds. */
export const MQTT_SESSION_EXPIRY_SEC = 600;

export type MqttPubSubOptions = {
  url: string;
  auth: MqttAuthFn;
  /** Stable MQTT client id reused across reconnects to resume its broker session. */
  clientIdPrefix: string;
  /** Injectable timers for reconnect delay. */
  timers: Timers;
  /** Injectable RNG for reconnect jitter. */
  random: () => number;
  /** Receives connect / transport / contained-handler warnings. */
  logger: Logger;
  reconnect?: { baseMs?: number; maxMs?: number };
  keepaliveSec?: number;
  /** MQTT protocol version; Aedes currently requires 3.1.1. */
  protocolVersion?: 4 | 5;
  /** Injectable for unit tests. Defaults to `mqtt.connect`. */
  connectFn?: MqttConnectFn;
  /**
   * Logical topic → broker topic. Identity, except on AWS IoT where `:`
   * would split a topic ARN. Must be injective: inbound messages are matched
   * by comparing the wire topic back to each logical subscription.
   */
  toWireTopic?: (topic: string) => string;
};

export function createMqttPubSub(options: MqttPubSubOptions): PubSub {
  return new MqttPubSub(options);
}

class MqttPubSub implements PubSub {
  private readonly url: string;
  private readonly auth: MqttAuthFn;
  private readonly clientId: string;
  private readonly baseMs: number;
  private readonly maxMs: number;
  private readonly keepaliveSec: number;
  private readonly protocolVersion: 4 | 5;
  private readonly connectFn: MqttConnectFn;
  private readonly toWireTopic: (topic: string) => string;
  private readonly timers: Timers;
  private readonly random: () => number;
  private readonly logger: Logger;

  private client: MqttClient | null = null;
  private currentStatus: PubSubStatus = 'connecting';
  private closed = false;
  private reconnectAttempt = 0;
  private reconnectTimer: unknown | null = null;
  private readonly topics = new Map<Topic, Set<Handler>>();
  private readonly statusListeners = new Set<(s: PubSubStatus) => void>();
  private connectWaiters = new Set<() => void>();

  constructor(options: MqttPubSubOptions) {
    this.url = options.url;
    this.auth = options.auth;
    this.clientId = options.clientIdPrefix;
    this.baseMs = options.reconnect?.baseMs ?? 500;
    this.maxMs = options.reconnect?.maxMs ?? 30_000;
    this.keepaliveSec = options.keepaliveSec ?? 30;
    this.protocolVersion = options.protocolVersion ?? 5;
    this.connectFn = options.connectFn ?? mqtt.connect;
    this.toWireTopic = options.toWireTopic ?? ((topic) => topic);
    this.timers = options.timers;
    this.random = options.random;
    this.logger = options.logger;
    rememberMqttClientId(this, this.clientId);
    void this.openConnection();
  }

  async publish(topic: Topic, data: unknown): Promise<void> {
    this.assertOpen();
    assertValidTopic(topic);
    const payload = encodePayload(data);
    await this.waitUntilConnected();
    const client = this.requireClient();
    await publishQos1(client, this.toWireTopic(topic), payload);
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
      this.client.subscribe(this.toWireTopic(topic), { qos: MQTT_PUBSUB_QOS });
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
    // Explicitly discard the broker session; reconnects retain it instead.
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
      this.client.unsubscribe(this.toWireTopic(topic));
    }
  }

  private async openConnection(): Promise<void> {
    if (this.closed) return;
    this.setStatus('connecting');
    try {
      const creds = await this.auth();
      if (this.closed) return;
      const clientOptions: IClientOptions = {
        clientId: this.clientId,
        username: creds.username,
        password: creds.password,
        clean: false,
        reconnectPeriod: 0,
        keepalive: this.keepaliveSec,
        protocolVersion: this.protocolVersion,
        ...(this.protocolVersion === 5
          ? {
              properties: {
                sessionExpiryInterval: MQTT_SESSION_EXPIRY_SEC,
              },
            }
          : {}),
      };
      const client = this.connectFn(this.url, clientOptions);
      this.client = client;
      this.wireClient(client);
    } catch (err) {
      this.logger.warn('connect failed', { error: String(err) });
      this.setStatus('down');
      this.scheduleReconnect();
    }
  }

  private wireClient(client: MqttClient): void {
    client.on('connect', () => {
      if (this.closed || this.client !== client) return;
      this.reconnectAttempt = 0;
      this.setStatus('connected');
      // Keep the app's desired set aligned after every reconnect.
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
      this.logger.warn('mqtt error', { error: String(err) });
    });
  }

  private resubscribeAll(client: MqttClient): void {
    for (const topic of this.topics.keys()) {
      client.subscribe(this.toWireTopic(topic), { qos: MQTT_PUBSUB_QOS });
    }
  }

  private logicalTopic(wireTopic: string): Topic | undefined {
    for (const topic of this.topics.keys()) {
      if (this.toWireTopic(topic) === wireTopic) return topic;
    }
    return undefined;
  }

  private dispatchMessage(wireTopic: string, raw: string): void {
    const data = decodePayload(raw, this.logger);
    if (data === undefined) return;
    const topic = this.logicalTopic(wireTopic);
    if (topic === undefined) return;
    const set = this.topics.get(topic);
    if (!set) return;
    for (const handler of [...set]) {
      try {
        handler(data);
      } catch (err) {
        this.logger.warn('handler error contained', { error: String(err) });
      }
    }
  }

  private scheduleReconnect(): void {
    if (this.closed || this.reconnectTimer) return;
    const delay = fullJitterDelayMs(
      this.reconnectAttempt,
      this.baseMs,
      this.maxMs,
      this.random
    );
    this.reconnectAttempt += 1;
    this.setStatus('connecting');
    this.reconnectTimer = this.timers.setTimeout(() => {
      this.reconnectTimer = null;
      const old = this.client;
      this.client = null;
      // Force-drop without sending expiry 0, preserving the broker session.
      old?.end(true);
      void this.openConnection();
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (!this.reconnectTimer) return;
    this.timers.clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  private setStatus(next: PubSubStatus): void {
    if (this.currentStatus === next) return;
    this.currentStatus = next;
    for (const cb of [...this.statusListeners]) {
      try {
        cb(next);
      } catch (err) {
        this.logger.warn('onStatus error contained', { error: String(err) });
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
      throw new PubSubPublishError('PubSub MQTT client is not connected');
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
      { qos: MQTT_PUBSUB_QOS, retain: false },
      (err) => {
        if (err) {
          reject(
            new PubSubPublishError(
              err instanceof Error ? err.message : 'MQTT publish failed'
            )
          );
        } else {
          resolve();
        }
      }
    );
  });
}
