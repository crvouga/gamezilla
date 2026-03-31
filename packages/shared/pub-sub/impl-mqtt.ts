import { connectAsync, type MqttClient } from 'mqtt';
import { assert } from '../assert';
import type { Listener, PubSub, Unsubscribe } from './interface';

/**
 * MQTT-backed {@link PubSub} for Bun/Node (EMQX, Mosquitto, etc.).
 * Messages are JSON-serialized on the wire.
 */
export class MqttPubSub implements PubSub {
  private readonly handlers = new Map<string, Set<Listener>>();

  private constructor(private readonly client: MqttClient) {
    this.client.on('message', (topic, payload) => {
      const set = this.handlers.get(topic);
      if (!set) return;
      let parsed: unknown;
      try {
        parsed = JSON.parse(payload.toString());
      } catch {
        parsed = payload.toString();
      }
      for (const h of set) {
        h(parsed);
      }
    });
  }

  /**
   * Connects to the broker and returns a ready {@link MqttPubSub}.
   */
  static async connect(url: string): Promise<MqttPubSub> {
    const client = await connectAsync(url);
    return new MqttPubSub(client);
  }

  publish(topic: string, message: unknown): void {
    void this.client.publishAsync(topic, JSON.stringify(message), {
      qos: 0,
    });
  }

  subscribe(topic: string, listener: Listener): Unsubscribe {
    let set = this.handlers.get(topic);
    if (!set) {
      set = new Set();
      this.handlers.set(topic, set);
      void this.client.subscribeAsync(topic, { qos: 0 });
    }
    set.add(listener);
    return () => {
      assert.defined(set, 'Listener set must exist when unsubscribing', {
        topic,
      });
      set.delete(listener);
      if (set.size === 0) {
        this.handlers.delete(topic);
        void this.client.unsubscribeAsync(topic);
      }
    };
  }

  next(topic: string): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const unsub = this.subscribe(topic, (message) => {
        try {
          unsub();
          resolve(message);
        } catch (e) {
          reject(e);
        }
      });
    });
  }

  async end(): Promise<void> {
    await this.client.endAsync();
  }
}
