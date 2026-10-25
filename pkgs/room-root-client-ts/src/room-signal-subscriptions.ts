import type { RoomSignalListener } from '@pkgs/room-root-shared-ts/signals';
import type { RoomCommandPayload } from '@pkgs/room-root-shared-ts/types';

/** No history/cache: a reconnect obtains fresh state from the live-session owner. */
export class RoomSignalSubscriptions {
  private readonly listeners = new Set<RoomSignalListener>();

  subscribe(listener: RoomSignalListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  publish(payload: RoomCommandPayload): void {
    for (const listener of [...this.listeners])
      if (this.listeners.has(listener)) listener(payload);
  }

  clear(): void {
    this.listeners.clear();
  }
}
