import type { PubSub, PubSubStatus, Topic } from '@pkgs/pubsub/interface';
import type { SqlClient } from '@pkgs/sql-client/interface';

import type { QueryRegistry, QueryRow } from '../queries/core/types';
import type { NudgePayload, QueryChannelsCtx } from '../shared/nudge-payload';
import type { MergeApplierDeps } from './merge';
import { REAL_TIMERS, type Timers } from './sim-ports';
import type { SubscriptionRuntime } from './subscription-runtime';

export type AttachNudgesOptions = {
  readonly pubsub: PubSub;
  readonly runtime: SubscriptionRuntime;
  readonly queryRegistry: QueryRegistry;
  readonly getChannelsCtx: () => QueryChannelsCtx;
  readonly remakePubSub: () => PubSub;
  readonly db: SqlClient;
  readonly timers?: Timers;
  readonly rowImageFanout?: boolean;
  readonly getMergeDeps?: () => MergeApplierDeps;
  readonly onBindTopicRefresh?: (refresh: () => void) => void;
  readonly onTablesChanged?: (
    listener: (tables: ReadonlySet<string>) => void
  ) => () => void;
  readonly onPubSubChanged?: (pubsub: PubSub) => void;
};

export type NudgeBag = {
  readonly options: AttachNudgesOptions;
  readonly timers: Timers;
  pubsub: PubSub;
  disposed: boolean;
  lastStatus: PubSubStatus;
  unbindStatus: (() => void) | null;
  readonly topicUnsubs: Map<Topic, () => void>;
  readonly topicToScopes: Map<Topic, Set<string>>;
  readonly pendingTopicCheckpoints: Map<Topic, string>;
  readonly disposers: Array<() => void>;
  lastTopicKey: string;
  membershipRemakePending: boolean;
  remakeFlushInFlight: boolean;
};

export function createNudgeBag(options: AttachNudgesOptions): NudgeBag {
  return {
    options,
    timers: options.timers ?? REAL_TIMERS,
    pubsub: options.pubsub,
    disposed: false,
    lastStatus: options.pubsub.status(),
    unbindStatus: null,
    topicUnsubs: new Map(),
    topicToScopes: new Map(),
    pendingTopicCheckpoints: new Map(),
    disposers: [],
    lastTopicKey: '',
    membershipRemakePending: false,
    remakeFlushInFlight: false,
  };
}

function parseNudgeTables(value: unknown): readonly string[] | undefined {
  if (value === undefined || !Array.isArray(value)) return undefined;
  const tables: string[] = [];
  for (const item of value) {
    if (typeof item === 'string' && item.length > 0) tables.push(item);
  }
  return tables.length > 0 ? tables : undefined;
}

function parseNudgeRows(
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

export function parseNudge(data: unknown): NudgePayload | null {
  if (data === null || typeof data !== 'object') return null;
  const record = data as Record<string, unknown>;
  const checkpoint = record['checkpoint'];
  if (typeof checkpoint !== 'string' || checkpoint.length === 0) return null;
  const tables = parseNudgeTables(record['tables']);
  const rows = parseNudgeRows(record['rows']);
  const optimistic =
    record['optimistic'] === true ? (true as const) : undefined;
  return {
    checkpoint,
    ...(optimistic !== undefined ? { optimistic } : {}),
    ...(tables !== undefined ? { tables } : {}),
    ...(rows !== undefined ? { rows } : {}),
  };
}

export function filterScopesByTables(
  bag: NudgeBag,
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
    if (query.hydrates.some((table) => tableSet.has(table))) {
      out.add(sub.scope);
    }
  }
  return out;
}
