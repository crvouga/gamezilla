/**
 * Macrotask yield used by the quiescence probe.
 * setImmediate is not banned by no-bare-io (only setTimeout/setInterval).
 * Fires strictly after the microtask queue has drained.
 */
export function waitQuiescence(): Promise<void> {
  return new Promise((resolve) => {
    setImmediate(resolve);
  });
}
