import type { PubSub } from '@pkgs/pubsub/interface';
import type { MqttPubSubOptions } from '@pkgs/pubsub-mqtt/create-mqtt-pubsub';
import {
  createMqttPubSub,
  MQTT_PUBSUB_QOS,
  MQTT_SESSION_EXPIRY_SEC,
} from '@pkgs/pubsub-mqtt/create-mqtt-pubsub';
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
