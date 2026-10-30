import type { TopicMap } from '@pkgs/sync-engine-shared-ts/topic-map';
import { ATTEMPT_TOPIC_MAP } from './attempt-topic-map';

export const puzzleContentTopic = 'system:game-puzzle-content' as const;

/** Public changes wake discovery; draft content only wakes its author's devices. */
export const CONTENT_TOPIC_MAP = {
  ...ATTEMPT_TOPIC_MAP,
  puzzle_content_documents: {
    topics: (_row, ctx) => [`user:${ctx.actorId}`],
    fallbackTopics: (ctx) => [`user:${ctx.actorId}`],
    rowImage: { publish: () => false },
  },
  puzzle_content_publications: {
    topics: (_row, ctx) => [`user:${ctx.actorId}`, puzzleContentTopic],
    fallbackTopics: (ctx) => [`user:${ctx.actorId}`, puzzleContentTopic],
    rowImage: { publish: () => false },
  },
  puzzle_content_drafts: {
    topics: (_row, ctx) => [`user:${ctx.actorId}`],
    rowImage: { publish: () => false },
  },
  puzzle_content_revisions: {
    topics: (_row, ctx) => [`user:${ctx.actorId}`, puzzleContentTopic],
    fallbackTopics: () => [puzzleContentTopic],
    rowImage: { publish: () => false },
  },
  puzzle_content_pack_items: {
    topics: (_row, ctx) => [`user:${ctx.actorId}`, puzzleContentTopic],
    fallbackTopics: () => [puzzleContentTopic],
    rowImage: { publish: () => false },
  },
} satisfies TopicMap;
