import { assertValidTopic, type Topic } from '@pkgs/pubsub/interface';

import type { Mutation, MutationEnv } from '../mutations/core/types';
import type { QueryDef } from '../queries/core/types';
import type { QueryChannelsCtx } from './push-payload';

const SENTINEL_CHANNELS_CTX: QueryChannelsCtx = {
  actorId: 'actor_x',
};

const SENTINEL_MUTATION_ENV: MutationEnv = {
  actorId: 'actor_x',
  deviceId: 'device_x',
  accountId: 'account_x',
  isAnon: false,
  now: () => new Date(0),
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
  if (q.channels === undefined) return;
  const parsed = q.params.safeParse({});
  const params = parsed.success
    ? parsed.data
    : ({
        spaceId: 'space_x',
        userId: 'user_x',
        ids: ['id_x'],
        username: 'user_x',
      } as unknown);
  assertTopics(
    `Query ${q.name} channels`,
    q.channels(params, SENTINEL_CHANNELS_CTX)
  );
}

/** Dev-mode / boot check: catch bad topic grammar at registry construction. */
export function validateMutationInvalidates(m: Mutation<unknown>): void {
  if (m.invalidates === undefined) return;
  const parsed = m.args.safeParse({
    spaceId: 'space_x',
    userId: 'user_x',
    username: 'user_x',
    visibility: 'private',
    title: 't',
    avatarConfig: {},
  });
  const args = parsed.success ? parsed.data : {};
  const result = m.invalidates(args, SENTINEL_MUTATION_ENV);
  if (result instanceof Promise) {
    void result.then((topics) =>
      assertTopics(`Mutation ${m.name} invalidates`, topics)
    );
    return;
  }
  assertTopics(`Mutation ${m.name} invalidates`, result);
}
