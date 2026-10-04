/**
 * Macrotask yield used by the quiescence probe.
 * Prefer `setImmediate` when present (Node / Bun); otherwise MessageChannel
 * (browsers) so virtual-time schedulers stay isomorphic — never `node:timers`.
 */
export function waitQuiescence(): Promise<void> {
  return new Promise((resolve) => {
    scheduleMacrotask(resolve);
  });
}

function scheduleMacrotask(cb: () => void): void {
  const g = globalThis as typeof globalThis & {
    setImmediate?: (fn: () => void) => unknown;
  };
  if (typeof g.setImmediate === 'function') {
    g.setImmediate(cb);
    return;
  }
  if (typeof MessageChannel !== 'undefined') {
    const { port1, port2 } = new MessageChannel();
    port1.onmessage = () => {
      cb();
    };
    port2.postMessage(null);
    return;
  }
  queueMicrotask(cb);
}
