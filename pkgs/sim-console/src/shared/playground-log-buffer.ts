import type { PlaygroundLogBuffer, PlaygroundLogEntry } from './ports';

const DEFAULT_CAPACITY = 500;

/** Ring-buffer log sink for a playground node (alice / bob / server). */
export function createPlaygroundLogBuffer(
  capacity = DEFAULT_CAPACITY
): PlaygroundLogBuffer {
  const entries: PlaygroundLogEntry[] = [];
  const listeners = new Set<() => void>();

  function notify(): void {
    for (const listener of listeners) {
      listener();
    }
  }

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    snapshot() {
      return entries;
    },
    append(entry) {
      entries.push(entry);
      if (entries.length > capacity) {
        entries.splice(0, entries.length - capacity);
      }
      notify();
    },
  };
}
