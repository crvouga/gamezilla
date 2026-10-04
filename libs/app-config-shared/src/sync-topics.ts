import type { Topic } from '@pkgs/pubsub-shared/topic';

/** Broadcast topic for the singleton client_config row. */
export function clientConfigTopic(): Topic {
  return 'system:client_config';
}

export function clientConfigChannels(): Topic[] {
  return [clientConfigTopic()];
}
