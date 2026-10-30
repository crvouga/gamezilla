import type { Topic } from '@pkgs/pubsub-root-shared-ts/topic';

import type { MutationDb, MutationEnv } from './mutations-types';
import type { QueryRow } from './v2';
import type { WriteCaptureSnapshot } from './write-capture';

export type TopicMapCtx = {
  readonly actorId: string;
  readonly deviceId: string;
  readonly accountId: string | null;
  readonly isAnon: boolean;
};

export type TopicMapRowImageGuard = {
  /** Veto publishing this local post-image as an optimistic hint. */
  readonly publish?: (row: QueryRow, ctx: TopicMapCtx) => boolean;
};

/** Live rows of every subscription-driving table, by table name. */
export type HeldRows = Readonly<Record<string, readonly QueryRow[]>>;

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
  /**
   * Resolve one table's rows together, returning one topic list per input row
   * in the same order. Each list must equal that row's `topics` destinations.
   * Repeated ids remain separate inputs, including earlier and later owners.
   * Database-backed projections share a fresh lookup within this call only.
   */
  readonly topicsByRow?: (
    rows: readonly QueryRow[],
    ctx: TopicMapCtx,
    db?: MutationDb
  ) => readonly (readonly Topic[])[] | Promise<readonly (readonly Topic[])[]>;
  /**
   * Opt-in subscribe projection for held-row topic sync.
   * When defined, local writes to this table resync subscriptions and each
   * live row is projected. When omitted, the table never drives subscriptions
   * (entry channel only) — publish still uses `topics`.
   * `held` lets a row defer to another held table, such as a membership row
   * that must not subscribe to a room its parent row says has ended.
   */
  readonly subscribeTopics?: (
    row: QueryRow,
    ctx: TopicMapCtx,
    held: HeldRows
  ) => readonly Topic[];
  /** Used when the table was touched but no row images/ids were captured. */
  readonly fallbackTopics?: (ctx: TopicMapCtx) => readonly Topic[];
  /** Optional publishing filter for row-image fanout. */
  readonly rowImage?: TopicMapRowImageGuard;
};

export type TopicMap = Readonly<Record<string, TopicMapEntry>>;

export function defineTopicMap(map: TopicMap): TopicMap {
  return map;
}

/** Tables whose topic-map entry opts into held-row subscription projection. */
export function subscribeTables(topicMap: TopicMap): ReadonlySet<string> {
  const out = new Set<string>();
  for (const [table, entry] of Object.entries(topicMap)) {
    if (entry.subscribeTopics !== undefined) out.add(table);
  }
  return out;
}

export function topicMapCtxFromEnv(env: MutationEnv): TopicMapCtx {
  return {
    actorId: env.actorId,
    deviceId: env.deviceId,
    accountId: env.accountId,
    isAnon: env.isAnon,
  };
}

/** Preserve per-row ownership when resolving an image batch or its wake union. */
export async function resolveTopicsByRow(args: {
  readonly entry: TopicMapEntry;
  readonly rows: readonly QueryRow[];
  readonly ctx: TopicMapCtx;
  readonly db?: MutationDb;
}): Promise<readonly (readonly Topic[])[]> {
  if (args.rows.length === 0) return [];
  if (args.entry.topicsByRow !== undefined) {
    const topics = await args.entry.topicsByRow(args.rows, args.ctx, args.db);
    if (topics.length !== args.rows.length)
      throw new Error('topic-map: batch destinations must match the row count');
    return topics;
  }
  const topics: (readonly Topic[])[] = [];
  for (const row of args.rows)
    topics.push(await args.entry.topics(row, args.ctx, args.db));
  return topics;
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
      for (const topics of await resolveTopicsByRow({
        entry,
        rows: images,
        ctx: args.ctx,
        ...(args.db === undefined ? {} : { db: args.db }),
      }))
        add(topics);
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
 * `liveRows` must already be filtered (no tombstones). Only tables with
 * `subscribeTopics` contribute row-derived topics.
 */
export function topicsFromHeldRows(args: {
  readonly topicMap: TopicMap;
  readonly liveRowsByTable: HeldRows;
  /** Every held subscription-driving table; defaults to `liveRowsByTable`. */
  readonly held?: HeldRows;
  readonly entryTopics: readonly Topic[];
  readonly ctx: TopicMapCtx;
}): Topic[] {
  const held = args.held ?? args.liveRowsByTable;
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
    if (entry === undefined || entry.subscribeTopics === undefined) continue;
    for (const row of rows) {
      add(entry.subscribeTopics(row, args.ctx, held));
    }
  }
  return out.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}
