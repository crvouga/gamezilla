import type { ProductHarnessLogBuffer, ProductHarnessLogEntry } from './ports';

const DEFAULT_CAPACITY = 500;

/** Ring-buffer log sink for a product-harness node (client-a / server-a). */
export function createProductHarnessLogBuffer(
  capacity = DEFAULT_CAPACITY
): ProductHarnessLogBuffer {
  const entries: ProductHarnessLogEntry[] = [];
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
