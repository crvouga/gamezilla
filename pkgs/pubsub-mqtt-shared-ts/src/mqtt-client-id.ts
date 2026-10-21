import type { PubSub } from '@pkgs/pubsub-root-shared-ts/interface';

const clientIds = new WeakMap<object, string>();

/** Associate an adapter with the stable MQTT client id used by its session. */
export function rememberMqttClientId(ps: object, clientId: string): void {
  clientIds.set(ps, clientId);
}

/** Return the stable MQTT client id for an adapter, when one is available. */
export function getMqttClientId(ps: PubSub): string | undefined {
  return clientIds.get(ps);
}
