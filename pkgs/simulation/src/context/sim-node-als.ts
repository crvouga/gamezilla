import { AsyncLocalStorage } from 'node:async_hooks';

const simNodeAls = new AsyncLocalStorage<string>();

/** Run work attributed to a simulation node (for global fetch diversion). */
export function runWithSimNode<T>(nodeId: string, fn: () => T): T {
  return simNodeAls.run(nodeId, fn);
}

export function getCurrentSimNodeId(): string | undefined {
  return simNodeAls.getStore();
}
