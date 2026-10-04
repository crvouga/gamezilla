import type { MqttPubSubOptions } from '@pkgs/pubsub-mqtt-shared/create-mqtt-pubsub';
import {
  createMqttPubSub,
  MQTT_PUBSUB_QOS,
  MQTT_SESSION_EXPIRY_SEC,
} from '@pkgs/pubsub-mqtt-shared/create-mqtt-pubsub';
import type { PubSub } from '@pkgs/pubsub-root-shared/interface';
import { rememberEmqxClientId } from './emqx-client-id';

/** MQTT QoS for EMQX publish + subscribe. */
export const EMQX_PUBSUB_QOS = MQTT_PUBSUB_QOS;

/** EMQX broker session lifetime after disconnect, in seconds. */
export const EMQX_SESSION_EXPIRY_SEC = MQTT_SESSION_EXPIRY_SEC;

export type EmqxPubSubOptions = MqttPubSubOptions;

/** EMQX MQTT/WebSocket adapter backed by the transport-neutral MQTT port. */
export function createEmqxPubSub(options: EmqxPubSubOptions): PubSub {
  const pubsub = createMqttPubSub(options);
  rememberEmqxClientId(pubsub, options.clientIdPrefix);
  return pubsub;
}
