import type { Topic } from '@pkgs/pubsub-root-shared-ts/topic';
import { assertValidTopic } from '@pkgs/pubsub-root-shared-ts/topic';
import type { QueryChannelsCtx } from './push-payload';
import type { QueryDef } from './queries-types';

const SENTINEL_CHANNELS_CTX: QueryChannelsCtx = {
  actorId: 'actor_x',
};

function assertTopics(label: string, topics: readonly Topic[]): void {
  for (const topic of topics) {
    try {
      assertValidTopic(topic);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`${label}: ${message}`);
    }
  }
}

/** Dev-mode / boot check: catch bad topic grammar at registry construction. */
export function validateQueryChannels(q: QueryDef<unknown>): void {
  if (q.entryChannel === undefined || q.entryChannel === false) return;
  const entryChannel = q.entryChannel;
  const params = (q.sampleParams ?? {}) as never;
  assertTopics(
    `Query ${q.name} entryChannel`,
    entryChannel(params, SENTINEL_CHANNELS_CTX)
  );
}
