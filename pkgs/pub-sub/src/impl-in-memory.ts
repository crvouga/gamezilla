import { assert } from '@pkgs/assert';
import type { Listener, PubSub, Unsubscribe } from './interface';

export class InMemoryPubSub implements PubSub {
  private listeners = new Map<string, Set<Listener>>();

  publish(topic: string, message: unknown): void {
    const set = this.listeners.get(topic);
    if (!set) return;
    for (const listener of set) {
      listener(message);
    }
  }

  subscribe(topic: string, listener: Listener): Unsubscribe {
    let set = this.listeners.get(topic);
    if (!set) {
      set = new Set();
      this.listeners.set(topic, set);
    }
    set.add(listener);
    return () => {
      assert.defined(set, 'Listener set must exist when unsubscribing', {
        topic,
        listener,
        set,
      });
      set.delete(listener);
      if (set.size === 0) {
        this.listeners.delete(topic);
      }
    };
  }

  next(topic: string): Promise<unknown> {
    return new Promise((resolve) => {
      const unsub = this.subscribe(topic, (message) => {
        resolve(message);
        unsub();
      });
    });
  }
}
