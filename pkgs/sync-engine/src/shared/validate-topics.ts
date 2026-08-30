import { assertValidTopic, type Topic } from '@pkgs/pubsub/interface';

import type { QueryDef } from '../queries/core/types';
import type { QueryChannelsCtx } from './push-payload';
import { QUERY_PARAM_STUB } from './standard-schema';

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
  // Fixed stub — no schema introspection; topic grammar only needs shape-ish keys.
  assertTopics(
    `Query ${q.name} entryChannel`,
    entryChannel(QUERY_PARAM_STUB as never, SENTINEL_CHANNELS_CTX)
  );
}
