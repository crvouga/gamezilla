import { assertValidTopic, type Topic } from '@pkgs/pubsub/interface';

import type { QueryDef } from '../queries/core/types';
import type { QueryChannelsCtx } from './push-payload';

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
  const parsed = (
    q.params ?? { safeParse: () => ({ success: true, data: {} }) }
  ).safeParse({});
  const params = parsed.success
    ? parsed.data
    : ({
        spaceId: 'space_x',
        userId: 'user_x',
        ids: ['id_x'],
        username: 'user_x',
      } as unknown);
  assertTopics(
    `Query ${q.name} entryChannel`,
    entryChannel(params, SENTINEL_CHANNELS_CTX)
  );
}
