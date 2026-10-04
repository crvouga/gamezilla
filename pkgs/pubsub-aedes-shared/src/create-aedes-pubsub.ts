import type { MqttPubSubOptions } from '@pkgs/pubsub-mqtt-shared/create-mqtt-pubsub';
import { createMqttPubSub } from '@pkgs/pubsub-mqtt-shared/create-mqtt-pubsub';
import type { PubSub } from '@pkgs/pubsub-shared/interface';

export type AedesPubSubOptions = Omit<MqttPubSubOptions, 'protocolVersion'>;

/** MQTT 3.1.1 PubSub adapter for an Aedes broker. */
export function createAedesPubSub(options: AedesPubSubOptions): PubSub {
  return createMqttPubSub({ ...options, protocolVersion: 4 });
}
