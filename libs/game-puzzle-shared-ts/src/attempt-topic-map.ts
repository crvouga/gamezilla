import type { TopicMap } from '@pkgs/sync-engine-shared-ts/topic-map';

export const ATTEMPT_TOPIC_MAP = {
  puzzle_content_attempts: {
    topics: (_row, ctx) => [`user:${ctx.actorId}`],
    rowImage: { publish: () => false },
  },
  puzzle_content_positions: {
    topics: (_row, ctx) => [`user:${ctx.actorId}`],
    rowImage: { publish: () => false },
  },
  puzzle_content_completions: {
    topics: (_row, ctx) => [`user:${ctx.actorId}`],
    rowImage: { publish: () => false },
  },
} satisfies TopicMap;
