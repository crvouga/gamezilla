import type { PubSub } from '@pkgs/pubsub-shared/interface';

const clientIds = new WeakMap<object, string>();

export function rememberEmqxClientId(ps: object, clientId: string): void {
  clientIds.set(ps, clientId);
}

/** Used by broker contract disruptTransport (force-disconnect). */
export function getEmqxClientId(ps: PubSub): string | undefined {
  return clientIds.get(ps);
}
