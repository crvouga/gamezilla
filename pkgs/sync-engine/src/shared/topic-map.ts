import type { Topic } from '@pkgs/pubsub/interface';

import type { MutationDb, MutationEnv } from '../mutations/core/types';
import type { QueryRow } from '../queries/core/types';
import type { WriteCaptureSnapshot } from '../sql-ast/write-capture';

export type TopicMapCtx = {
  readonly actorId: string;
  readonly deviceId: string;
  readonly accountId: string | null;
  readonly isAnon: boolean;
};

export type TopicMapEntry = {
  /**
   * Derive topics from a post-image row. Async + db requires a
   * `// topic-map-db: <reason>` annotation at the call site in product code.
   */
  readonly topics: (
    row: QueryRow,
    ctx: TopicMapCtx,
    db?: MutationDb
  ) => readonly Topic[] | Promise<readonly Topic[]>;
  /** Used when the table was touched but no row images/ids were captured. */
  readonly fallbackTopics?: (ctx: TopicMapCtx) => readonly Topic[];
};

export type TopicMap = Readonly<Record<string, TopicMapEntry>>;

export function defineTopicMap(map: TopicMap): TopicMap {
  return map;
}

export function topicMapCtxFromEnv(env: MutationEnv): TopicMapCtx {
  return {
    actorId: env.actorId,
    deviceId: env.deviceId,
    accountId: env.accountId,
    isAnon: env.isAnon,
  };
}

/**
 * Feed captured post-images (and fallbacks for touch-only tables) through the
 * topic map. Topics are sorted for determinism.
 */
export async function topicsFromWriteCapture(args: {
  readonly topicMap: TopicMap;
  readonly capture: WriteCaptureSnapshot;
  readonly ctx: TopicMapCtx;
  readonly db?: MutationDb;
}): Promise<Topic[]> {
  const seen = new Set<Topic>();
  const out: Topic[] = [];
  const add = (topics: readonly Topic[]) => {
    for (const t of topics) {
      if (seen.has(t)) continue;
      seen.add(t);
      out.push(t);
    }
  };

  for (const table of args.capture.tables) {
    const entry = args.topicMap[table];
    if (entry === undefined) continue;
    const images = args.capture.images[table] ?? [];
    if (images.length > 0) {
      for (const row of images) {
        add(await Promise.resolve(entry.topics(row, args.ctx, args.db)));
      }
      continue;
    }
    if (entry.fallbackTopics !== undefined) {
      add(entry.fallbackTopics(args.ctx));
      continue;
    }
    // Map needs row data but none captured — skip (caller may SELECT fallback).
  }

  return out.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/**
 * Derive subscribe topics from live held rows + entry channel.
 * `liveRows` must already be filtered (no tombstones; spaces non-ended).
 */
export function topicsFromHeldRows(args: {
  readonly topicMap: TopicMap;
  readonly liveRowsByTable: Readonly<Record<string, readonly QueryRow[]>>;
  readonly entryTopics: readonly Topic[];
  readonly ctx: TopicMapCtx;
}): Topic[] {
  const seen = new Set<Topic>();
  const out: Topic[] = [];
  const add = (topics: readonly Topic[]) => {
    for (const t of topics) {
      if (seen.has(t)) continue;
      seen.add(t);
      out.push(t);
    }
  };
  add(args.entryTopics);
  for (const [table, rows] of Object.entries(args.liveRowsByTable)) {
    const entry = args.topicMap[table];
    if (entry === undefined) continue;
    for (const row of rows) {
      const result = entry.topics(row, args.ctx);
      if (result instanceof Promise) {
        // Channel derivation is sync — async maps are mutation-only.
        continue;
      }
      add(result);
    }
  }
  return out.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}
