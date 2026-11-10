import { PubSubPublishError } from '@pkgs/pubsub-root-shared-ts/pubsub-publish-error';

/**
 * The broker refused one publish with an MQTT 5 reason code (0x80 and
 * above: 0x87 not authorized, 0x90 topic name invalid, …). The connection
 * that carried the answer is still up.
 */
export class MqttPublishRefusedError extends PubSubPublishError {}

/** Whether an MQTT 5 reason code is a refusal the broker answered. */
export function isRefusalCode(code: number | undefined): boolean {
  return code !== undefined && code >= 0x80;
}
