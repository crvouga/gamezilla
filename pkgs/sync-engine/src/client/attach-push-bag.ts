import type { PubSub, PubSubStatus, Topic } from '@pkgs/pubsub/interface';
import type { SqlClient } from '@pkgs/sql-client/interface';

import type { QueryRegistry, QueryRow } from '../queries/core/types';
import type { PushMessage, QueryChannelsCtx } from '../shared/push-payload';
import { subscribeTables, type TopicMap } from '../shared/topic-map';
import type { MergeApplierDeps } from './merge';
import type { Timers } from './sim-ports';
import type { SubscriptionRuntime } from './subscription-runtime';

export type AttachPushOptions = {
  readonly pubsub: PubSub;
  readonly runtime: SubscriptionRuntime;
  readonly queryRegistry: QueryRegistry;
  readonly getChannelsCtx: () => QueryChannelsCtx;
  readonly remakePubSub: () => PubSub;
  readonly db: SqlClient;
  readonly timers: Timers;
  readonly now: () => number;
  readonly rowImageFanout?: boolean;
  readonly getMergeDeps?: () => MergeApplierDeps;
  readonly onBindTopicRefresh?: (refresh: () => void) => void;
  readonly onTablesChanged?: (
    listener: (tables: ReadonlySet<string>) => void
  ) => () => void;
  readonly onPubSubChanged?: (pubsub: PubSub) => void;
  readonly topicMap?: TopicMap;
  readonly defaultEntryChannel?: (
    params: unknown,
    ctx: QueryChannelsCtx
  ) => readonly Topic[];
};

export type PushBag = {
  readonly options: AttachPushOptions;
  readonly timers: Timers;
  pubsub: PubSub;
  disposed: boolean;
  lastStatus: PubSubStatus;
  unbindStatus: (() => void) | null;
  readonly topicUnsubs: Map<Topic, () => void>;
  readonly topicToScopes: Map<Topic, Set<string>>;
  readonly pendingTopicPushSeqs: Map<Topic, string>;
  /** Row-derived topics per scope (live projection after merge). */
  readonly scopeRowTopics: Map<string, readonly Topic[]>;
  /** Tables with `subscribeTopics` — local writes resync held-row topics. */
  readonly subscribeTables: ReadonlySet<string>;
  readonly disposers: Array<() => void>;
  lastTopicKey: string;
  membershipRemakePending: boolean;
  remakeFlushInFlight: boolean;
  remakeFlushQueued: boolean;
};

export function createPushBag(options: AttachPushOptions): PushBag {
  return {
    options,
    timers: options.timers,
    pubsub: options.pubsub,
    disposed: false,
    lastStatus: options.pubsub.status(),
    unbindStatus: null,
    topicUnsubs: new Map(),
    topicToScopes: new Map(),
    pendingTopicPushSeqs: new Map(),
    scopeRowTopics: new Map(),
    subscribeTables:
      options.topicMap !== undefined
        ? subscribeTables(options.topicMap)
        : new Set(),
    disposers: [],
    lastTopicKey: '',
    membershipRemakePending: false,
    remakeFlushInFlight: false,
    remakeFlushQueued: false,
  };
}

function parsePushTables(value: unknown): readonly string[] | undefined {
  if (value === undefined || !Array.isArray(value)) return undefined;
  const tables: string[] = [];
  for (const item of value) {
    if (typeof item === 'string' && item.length > 0) tables.push(item);
  }
  return tables.length > 0 ? tables : undefined;
}

function parsePushRows(
  value: unknown
): Readonly<Record<string, readonly QueryRow[]>> | undefined {
  if (value === undefined || value === null || typeof value !== 'object') {
    return undefined;
  }
  if (Array.isArray(value)) return undefined;
  const out: Record<string, QueryRow[]> = {};
  for (const [table, rows] of Object.entries(
    value as Record<string, unknown>
  )) {
    if (!Array.isArray(rows)) continue;
    const parsed: QueryRow[] = [];
    for (const row of rows) {
      if (row !== null && typeof row === 'object' && !Array.isArray(row)) {
        parsed.push(row as QueryRow);
      }
    }
    if (parsed.length > 0) out[table] = parsed;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export function parsePush(data: unknown): PushMessage | null {
  if (data === null || typeof data !== 'object') return null;
  const record = data as Record<string, unknown>;
  const pushSeq = record['pushSeq'];
  if (typeof pushSeq !== 'string' || pushSeq.length === 0) return null;
  const tables = parsePushTables(record['tables']);
  const rows = parsePushRows(record['rows']);
  const optimistic =
    record['optimistic'] === true ? (true as const) : undefined;
  return {
    pushSeq,
    ...(optimistic !== undefined ? { optimistic } : {}),
    ...(tables !== undefined ? { tables } : {}),
    ...(rows !== undefined ? { rows } : {}),
  };
}

export function filterScopesByTables(
  bag: PushBag,
  scopes: ReadonlySet<string>,
  tables: readonly string[] | undefined
): Set<string> {
  if (tables === undefined || tables.length === 0) return new Set(scopes);
  const tableSet = new Set(tables);
  const out = new Set<string>();
  for (const sub of bag.options.runtime.listActive()) {
    if (!scopes.has(sub.scope)) continue;
    const query = bag.options.queryRegistry[sub.name];
    if (query === undefined) continue;
    // Client never runs defineQuery.run locally, so hydrates stay [] until
    // eagerly resolved. Unresolved → cannot prove non-overlap; wake the scope
    // or table-filtered OOB pushes (e.g. outbox notifications) are dropped.
    if (
      query.hydrates.length === 0 ||
      query.hydrates.some((table) => tableSet.has(table))
    ) {
      out.add(sub.scope);
    }
  }
  return out;
}
