/**
 * App topics use `:` (`user:actor1`). AWS IoT topic ARNs split on `:`, so
 * the broker wire uses `/` (`user/actor1`). Local EMQX and Aedes keep the
 * colon form. Only the IoT publisher, the wss client, and the authorizer
 * call this.
 */
export function iotWireTopic(topic: string): string {
  return topic.replaceAll(':', '/');
}
