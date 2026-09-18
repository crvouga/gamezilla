import type { PubSub } from '@pkgs/pubsub/interface';
import {
  createMqttPubSub,
  type MqttPubSubOptions,
} from '@pkgs/pubsub-mqtt/create-mqtt-pubsub';

export type AedesPubSubOptions = Omit<MqttPubSubOptions, 'protocolVersion'>;

/** MQTT 3.1.1 PubSub adapter for an Aedes broker. */
export function createAedesPubSub(options: AedesPubSubOptions): PubSub {
  return createMqttPubSub({ ...options, protocolVersion: 4 });
}
