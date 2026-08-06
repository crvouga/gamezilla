import type { PubSub, Topic } from '@pkgs/pubsub/interface';
import type { Mutation, MutationEnv } from '../mutations/core/types';
import {
  buildMutationFanoutPayload,
  type MutationFanoutPayload,
} from '../shared/mutation-fanout-payload';

export type MutationFanoutPublishEvent = {
  readonly mutationId: string;
  readonly mutation: Mutation<unknown>;
  readonly args: unknown;
  readonly seq: number;
  readonly createdAt: string;
  readonly env: MutationEnv;
  readonly clientId: string;
};

async function resolveFanoutTopics(
  mutation: Mutation<unknown>,
  args: unknown,
  env: MutationEnv
): Promise<readonly Topic[]> {
  if (mutation.invalidates === undefined) {
    return [`user:${env.actorId}`];
  }
  // No db — sync topics only (room + actor). Party expansion stays server-side.
  const topics = await Promise.resolve(mutation.invalidates(args, env));
  return [...new Set(topics)];
}

/** Best-effort MQTT fanout after local mutate. Never throws to the caller. */
export function publishMutationFanout(args: {
  readonly pubsub: PubSub;
  readonly event: MutationFanoutPublishEvent;
}): void {
  const { pubsub, event } = args;
  if (pubsub.status() !== 'connected') return;
  const payload: MutationFanoutPayload = buildMutationFanoutPayload({
    mutationId: event.mutationId,
    name: event.mutation.name,
    args: event.args,
    actorId: event.env.actorId,
    deviceId: event.env.deviceId,
    accountId: event.env.accountId,
    clientId: event.clientId,
    seq: event.seq,
    createdAt: event.createdAt,
  });
  void resolveFanoutTopics(event.mutation, event.args, event.env)
    .then((topics) => {
      for (const topic of topics) {
        void pubsub.publish(topic, payload).catch((error: unknown) => {
          console.warn(
            `[sync] mutation fanout publish failed topic=${topic}`,
            error
          );
        });
      }
    })
    .catch((error: unknown) => {
      console.warn('[sync] mutation fanout topic resolve failed', error);
    });
}
