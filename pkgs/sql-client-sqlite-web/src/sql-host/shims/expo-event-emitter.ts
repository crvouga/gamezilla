/**
 * Web event emitter backing `NativeModule` in the sql-host `expo` shim.
 *
 * Mirrors `expo-modules-core`'s web polyfill: expo-sqlite's web module emits
 * `onDatabaseChange` through this, so listener errors must stay contained.
 */

type Listener = (...args: unknown[]) => void;

export class EventEmitter {
  private listeners = new Map<string, Set<Listener>>();

  addListener(eventName: string, listener: Listener): { remove: () => void } {
    const set = this.listeners.get(eventName) ?? new Set<Listener>();
    set.add(listener);
    this.listeners.set(eventName, set);
    return { remove: () => this.removeListener(eventName, listener) };
  }

  removeListener(eventName: string, listener: Listener): void {
    this.listeners.get(eventName)?.delete(listener);
  }

  removeAllListeners(eventName: string): void {
    this.listeners.get(eventName)?.clear();
  }

  listenerCount(eventName: string): number {
    return this.listeners.get(eventName)?.size ?? 0;
  }

  emit(eventName: string, ...args: unknown[]): void {
    for (const listener of new Set(this.listeners.get(eventName))) {
      try {
        listener(...args);
      } catch (error: unknown) {
        // A misbehaving listener must not abort the remaining listeners.
        console.error(error);
      }
    }
  }

  startObserving(_eventName: string): void {
    // no-op on web
  }

  stopObserving(_eventName: string): void {
    // no-op on web
  }
}
