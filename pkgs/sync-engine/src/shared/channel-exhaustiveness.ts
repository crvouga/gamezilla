import type { Topic } from '@pkgs/pubsub/interface';

import { mutationRegistry } from '../mutations/core/registry';
import type { Mutation, MutationEnv } from '../mutations/core/types';
import { withFrameworkMutations } from '../mutations/shared/with-framework-mutations';
import type { QueryDef } from '../queries/core/types';
import type { QueryChannelsCtx } from './push-payload';

const SENTINEL_CHANNELS_CTX = {
  actorId: 'actor_x',
  membershipSpaceIds: ['space_x'],
} as QueryChannelsCtx;

const SENTINEL_MUTATION_ENV: MutationEnv = {
  actorId: 'actor_x',
  deviceId: 'device_x',
  accountId: 'account_x',
  isAnon: false,
  now: () => new Date(0),
};

const SENTINEL_MUTATION_ARGS = {
  spaceId: 'space_x',
  userId: 'user_x',
  toUserId: 'user_x',
  requestId: 'req_x',
  blockId: 'block_x',
  username: 'user_x',
  visibility: 'private',
  title: 't',
  avatarConfig: {},
  interactionId: 'ix_x',
  ownerId: 'actor_x',
  puzzleId: 'pz_x',
  puzzleRating: 1000,
  kind: 'started',
  solveIdx: 0,
  rating: 1000,
  ratingDeviation: 100,
  rejectionId: 'rej_x',
  ids: ['id_x'],
} as const;

export type ChannelGap = {
  readonly mutation: string;
  readonly query: string;
  readonly tables: readonly string[];
};

function tablesOverlap(
  declaredWrites: readonly string[],
  hydrates: readonly string[]
): string[] {
  const hydrateSet = new Set(hydrates);
  return declaredWrites.filter((t) => hydrateSet.has(t));
}

function topicsOverlap(
  left: readonly Topic[],
  right: readonly Topic[]
): boolean {
  const rightSet = new Set(right);
  return left.some((t) => rightSet.has(t));
}

function mutationTopics(m: Mutation<unknown>): Topic[] {
  if (m.invalidates === undefined) return [];
  const parsed = m.args.safeParse(SENTINEL_MUTATION_ARGS);
  const args = parsed.success ? parsed.data : SENTINEL_MUTATION_ARGS;
  const result = m.invalidates(args, SENTINEL_MUTATION_ENV);
  // Exhaustiveness is sync/static; async party expansion is validated at runtime.
  if (result instanceof Promise) return [`user:actor_x`, `room:space_x`];
  return [...result];
}

function queryTopics(q: QueryDef<unknown>): Topic[] {
  if (q.channels === undefined) return [];
  const parsed = q.params.safeParse(SENTINEL_MUTATION_ARGS);
  const params = parsed.success ? parsed.data : SENTINEL_MUTATION_ARGS;
  return q.channels(params as never, SENTINEL_CHANNELS_CTX);
}

/**
 * For every (mutation, query) with declaredWrites ∩ hydrates ≠ ∅, require
 * invalidates topics ∩ channels topics ≠ ∅. Returns named gaps.
 */
export function findChannelExhaustivenessGaps(
  mutations: readonly Mutation<unknown>[],
  queries: readonly QueryDef<unknown>[]
): ChannelGap[] {
  const gaps: ChannelGap[] = [];
  for (const mutation of mutations) {
    for (const query of queries) {
      const tables = tablesOverlap(mutation.declaredWrites, query.hydrates);
      if (tables.length === 0) continue;
      const inv = mutationTopics(mutation);
      const ch = queryTopics(query);
      if (topicsOverlap(inv, ch)) continue;
      gaps.push({
        mutation: mutation.name,
        query: query.name,
        tables,
      });
    }
  }
  return gaps;
}

/** Throws with named pairs when any gap exists. */
export function assertChannelExhaustiveness(
  mutations: readonly Mutation<unknown>[],
  queries: readonly QueryDef<unknown>[]
): void {
  // Framework mutations are merged inside createSyncApp / createLocalSyncEngine;
  // include them here so CI matches runtime registries without a manual merge.
  const merged = Object.values(
    withFrameworkMutations(mutationRegistry(mutations))
  ) as Mutation<unknown>[];
  const gaps = findChannelExhaustivenessGaps(merged, queries);
  if (gaps.length === 0) return;
  const lines = gaps.map(
    (g) => `  ${g.mutation} → ${g.query} (tables: ${g.tables.join(', ')})`
  );
  throw new Error(
    `Channel exhaustiveness failed — declaredWrites∩hydrates without overlapping topics:\n${lines.join('\n')}`
  );
}
