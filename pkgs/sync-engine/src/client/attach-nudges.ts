import type { PubSub, PubSubStatus, Topic } from '@pkgs/pubsub/interface';
import { sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';
import type { TableChangeBus } from '@pkgs/sync-engine/queries/client/table-change-bus';
import type { QueryRegistry } from '@pkgs/sync-engine/queries/core/types';
import type { MutationRegistry } from '@pkgs/sync-engine/mutations/core/types';
import { parseMutationFanout } from '@pkgs/sync-engine/shared/mutation-fanout-payload';
import type {
  NudgePayload,
  QueryChannelsCtx,
} from '@pkgs/sync-engine/shared/nudge-payload';

import { peerApplyMutation } from './peer-apply-mutation';
import { STATUS_POLL_JITTER_MS } from './subscription-constants';
import type { SubscriptionRuntime } from './subscription-runtime';

const DEFAULT_DEBOUNCE_MS = 150;
const DEFAULT_LATE_TOPIC_REMAKE_MS = 10_000;

export type AttachNudgesOptions = {
  readonly pubsub: PubSub;
  readonly runtime: SubscriptionRuntime;
  readonly queryRegistry: QueryRegistry;
  readonly mutationRegistry: MutationRegistry;
  readonly bus: TableChangeBus;
  readonly db: SqlClient;
  readonly getChannelsCtx: () => QueryChannelsCtx;
  readonly remakePubSub: () => PubSub;
  readonly debounceMs?: number;
  readonly lateTopicRemakeMs?: number;
  /** When set, upload-ack refreshes coalesce through the same debounce path. */
  readonly onScheduleWakeAll?: (wakeAll: () => void) => void;
  /** Register a callback to re-derive MQTT topics after channels ctx changes. */
  readonly onBindTopicRefresh?: (refresh: () => void) => void;
  /** Keep an outer pubsub ref current across remakes (mutation fanout). */
  readonly onPubSubInstance?: (pubsub: PubSub) => void;
  /** Re-sync topics when membership tables change locally. */
  readonly onTablesChanged?: (
    listener: (tables: ReadonlySet<string>) => void
  ) => () => void;
};

/** `'all'` = full active set (upload-ack); otherwise a scope subset. */
type PendingSweep = 'all' | Set<string>;

type NudgeBag = {
  readonly options: AttachNudgesOptions;
  readonly debounceMs: number;
  readonly lateTopicRemakeMs: number;
  pubsub: PubSub;
  disposed: boolean;
  lastStatus: PubSubStatus;
  trackLateTopics: boolean;
  unbindStatus: (() => void) | null;
  remakeScheduled: boolean;
  coalesceInWindow: boolean;
  coalesceTrailing: ReturnType<typeof setTimeout> | null;
  pendingSweep: PendingSweep | null;
  readonly topicUnsubs: Map<Topic, () => void>;
  readonly topicToScopes: Map<Topic, Set<string>>;
  readonly lateTopics: Map<Topic, ReturnType<typeof setTimeout>>;
  readonly topicsAtInstanceBirth: Set<Topic>;
  readonly disposers: Array<() => void>;
};

function parseNudgeTables(value: unknown): readonly string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) return undefined;
  const tables: string[] = [];
  for (const item of value) {
    if (typeof item === 'string' && item.length > 0) tables.push(item);
  }
  return tables.length > 0 ? tables : undefined;
}

function parseNudge(data: unknown): NudgePayload | null {
  if (data === null || typeof data !== 'object') return null;
  const record = data as Record<string, unknown>;
  const tables = parseNudgeTables(record['tables']);
  if (!('checkpoint' in record) || record['checkpoint'] === undefined) {
    return tables !== undefined ? { tables } : {};
  }
  if (typeof record['checkpoint'] !== 'string') return null;
  return {
    checkpoint: record['checkpoint'],
    ...(tables !== undefined ? { tables } : {}),
  };
}

/** When nudge lists tables, only wake scopes whose query hydrates them. */
function filterScopesByTables(
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

function createBag(options: AttachNudgesOptions): NudgeBag {
  return {
    options,
    debounceMs: options.debounceMs ?? DEFAULT_DEBOUNCE_MS,
    lateTopicRemakeMs:
      options.lateTopicRemakeMs ?? DEFAULT_LATE_TOPIC_REMAKE_MS,
    pubsub: options.pubsub,
    disposed: false,
    lastStatus: options.pubsub.status(),
    trackLateTopics: false,
    unbindStatus: null,
    remakeScheduled: false,
    coalesceInWindow: false,
    coalesceTrailing: null,
    pendingSweep: null,
    topicUnsubs: new Map(),
    topicToScopes: new Map(),
    lateTopics: new Map(),
    topicsAtInstanceBirth: new Set(),
    disposers: [],
  };
}

function mergePendingSweep(
  bag: NudgeBag,
  scopes: 'all' | Iterable<string>
): void {
  if (scopes === 'all') {
    bag.pendingSweep = 'all';
    return;
  }
  if (bag.pendingSweep === 'all') return;
  if (bag.pendingSweep === null) bag.pendingSweep = new Set();
  for (const scope of scopes) bag.pendingSweep.add(scope);
}

function flushPendingSweep(bag: NudgeBag): void {
  const pending = bag.pendingSweep;
  bag.pendingSweep = null;
  if (pending === null) return;
  if (pending === 'all') {
    bag.options.runtime.wakeAll('nudge');
    return;
  }
  if (pending.size === 0) return;
  if (pending.size === 1) {
    bag.options.runtime.wakeScope([...pending][0]!);
    return;
  }
  bag.options.runtime.wakeScopes([...pending], 'nudge');
}

/**
 * Leading + trailing debounce shared across nudges and upload-ack so a
 * shared-topic fanout becomes one batch POST instead of N singles.
 */
function scheduleSweep(bag: NudgeBag, scopes: 'all' | Iterable<string>): void {
  mergePendingSweep(bag, scopes);
  if (!bag.coalesceInWindow) {
    bag.coalesceInWindow = true;
    flushPendingSweep(bag);
    bag.coalesceTrailing = setTimeout(() => {
      bag.coalesceInWindow = false;
      bag.coalesceTrailing = null;
    }, bag.debounceMs);
    return;
  }
  if (bag.coalesceTrailing !== null) clearTimeout(bag.coalesceTrailing);
  bag.coalesceTrailing = setTimeout(() => {
    bag.coalesceInWindow = false;
    bag.coalesceTrailing = null;
    flushPendingSweep(bag);
  }, bag.debounceMs);
}

function scheduleWakeAllDebounced(bag: NudgeBag): void {
  scheduleSweep(bag, 'all');
}

function checkpointAlreadyApplied(checkpoint: string, last: string): boolean {
  // Same wire format as query/mutation checkpoints (digits only, fixed pad).
  if (checkpoint.length === last.length) return checkpoint <= last;
  if (/^\d+$/.test(checkpoint) && /^\d+$/.test(last)) {
    return (
      checkpoint.length < last.length ||
      (checkpoint.length === last.length && checkpoint <= last)
    );
  }
  return checkpoint <= last;
}

async function shouldSkipCheckpoint(
  bag: NudgeBag,
  scope: string,
  checkpoint: string
): Promise<boolean> {
  const rows = await bag.options.db.query(sql<{
    last_checkpoint: string | null;
  }>`
    SELECT last_checkpoint FROM _scope_meta
    WHERE scope_hash = ${scope}
    LIMIT 1
  `);
  const last = rows[0]?.last_checkpoint;
  if (last === null || last === undefined) return false;
  return checkpointAlreadyApplied(checkpoint, last);
}

function handleMutationFanout(
  bag: NudgeBag,
  topic: Topic,
  data: unknown
): boolean {
  const fanout = parseMutationFanout(data);
  if (fanout === null) return false;
  void peerApplyMutation({
    db: bag.options.db,
    bus: bag.options.bus,
    registry: bag.options.mutationRegistry,
    topic,
    payload: fanout,
    getChannelsCtx: bag.options.getChannelsCtx,
  });
  return true;
}

function handleNudge(bag: NudgeBag, topic: Topic, data: unknown): void {
  if (bag.disposed) return;
  if (handleMutationFanout(bag, topic, data)) return;
  const payload = parseNudge(data);
  if (payload === null) return;
  const topicScopes = bag.topicToScopes.get(topic);
  if (topicScopes === undefined) return;
  const scopes = filterScopesByTables(bag, topicScopes, payload.tables);
  if (scopes.size === 0) return;
  const checkpoint = payload.checkpoint;
  if (checkpoint === undefined) {
    scheduleSweep(bag, scopes);
    return;
  }
  void collectNeedingScopes(bag, scopes, checkpoint).then((needing) => {
    if (!bag.disposed && needing.length > 0) scheduleSweep(bag, needing);
  });
}

async function collectNeedingScopes(
  bag: NudgeBag,
  scopes: ReadonlySet<string>,
  checkpoint: string
): Promise<string[]> {
  // Parallel — serial awaits added tens/hundreds of ms before refetch started.
  const checks = await Promise.all(
    [...scopes].map(async (scope) => {
      const skip = await shouldSkipCheckpoint(bag, scope, checkpoint);
      return skip ? null : scope;
    })
  );
  return checks.filter((scope): scope is string => scope !== null);
}

function clearLateTimer(bag: NudgeBag, topic: Topic): void {
  const timer = bag.lateTopics.get(topic);
  if (timer === undefined) return;
  clearTimeout(timer);
  bag.lateTopics.delete(topic);
}

function collectDesiredTopics(bag: NudgeBag): Map<Topic, Set<string>> {
  const ctx = bag.options.getChannelsCtx();
  const desired = new Map<Topic, Set<string>>();
  for (const sub of bag.options.runtime.listActive()) {
    const query = bag.options.queryRegistry[sub.name];
    const channels =
      query?.channels?.(sub.params as never, ctx) ?? ([] as Topic[]);
    for (const topic of channels) {
      let scopes = desired.get(topic);
      if (scopes === undefined) {
        scopes = new Set();
        desired.set(topic, scopes);
      }
      scopes.add(sub.scope);
    }
  }
  return desired;
}

function dropStaleTopics(
  bag: NudgeBag,
  desired: Map<Topic, Set<string>>
): void {
  for (const topic of [...bag.topicUnsubs.keys()]) {
    if (desired.has(topic)) continue;
    bag.topicUnsubs.get(topic)?.();
    bag.topicUnsubs.delete(topic);
    bag.topicToScopes.delete(topic);
    clearLateTimer(bag, topic);
  }
}

function armLateTopicTimer(bag: NudgeBag, topic: Topic): void {
  if (!bag.trackLateTopics) return;
  if (bag.topicsAtInstanceBirth.has(topic)) return;
  if (bag.lateTopics.has(topic)) return;
  const timer = setTimeout(() => {
    bag.lateTopics.delete(topic);
    if (bag.disposed || bag.remakeScheduled) return;
    if (!bag.topicToScopes.has(topic)) return;
    bag.remakeScheduled = true;
    remake(bag);
  }, bag.lateTopicRemakeMs);
  bag.lateTopics.set(topic, timer);
}

function ensureTopicSubscribed(bag: NudgeBag, topic: Topic): void {
  if (bag.topicUnsubs.has(topic)) return;
  try {
    const unsub = bag.pubsub.subscribe(topic, (data) =>
      handleNudge(bag, topic, data)
    );
    bag.topicUnsubs.set(topic, unsub);
  } catch (error) {
    console.warn('[nudges] subscribe failed', topic, error);
    return;
  }
  armLateTopicTimer(bag, topic);
}

function syncTopics(bag: NudgeBag): void {
  if (bag.disposed) return;
  const desired = collectDesiredTopics(bag);
  dropStaleTopics(bag, desired);
  for (const [topic, scopes] of desired) {
    bag.topicToScopes.set(topic, scopes);
    ensureTopicSubscribed(bag, topic);
  }
}

function clearTopicState(bag: NudgeBag): void {
  for (const unsub of bag.topicUnsubs.values()) unsub();
  bag.topicUnsubs.clear();
  bag.topicToScopes.clear();
  for (const timer of bag.lateTopics.values()) clearTimeout(timer);
  bag.lateTopics.clear();
  bag.topicsAtInstanceBirth.clear();
}

function seedBirthTopics(bag: NudgeBag): void {
  for (const topic of bag.topicUnsubs.keys()) {
    bag.topicsAtInstanceBirth.add(topic);
  }
  bag.trackLateTopics = true;
}

function remake(bag: NudgeBag): void {
  if (bag.disposed) return;
  clearTopicState(bag);
  bag.trackLateTopics = false;
  bag.unbindStatus?.();
  bag.unbindStatus = null;
  try {
    bag.pubsub.close();
  } catch {
    // ignore
  }
  bag.pubsub = bag.options.remakePubSub();
  bag.options.onPubSubInstance?.(bag.pubsub);
  bag.remakeScheduled = false;
  bindStatus(bag, bag.pubsub);
  syncTopics(bag);
  seedBirthTopics(bag);
}

function onStatus(bag: NudgeBag, next: PubSubStatus): void {
  if (bag.disposed) return;
  const prev = bag.lastStatus;
  bag.lastStatus = next;
  if (next === 'connected') {
    bag.options.runtime.setConnectedMode(true);
    // Catch-up after reconnect (down→connecting→connected; prev is rarely `down`).
    if (prev !== 'connected') {
      bag.options.runtime.wakeAllWithJitter(STATUS_POLL_JITTER_MS);
    }
    return;
  }
  if (next === 'down') {
    // Arm FALLBACK only — do not wakeAll here. Auth reconnect flaps were
    // storming /api/query via wakeAllWithJitter on every failed attempt.
    bag.options.runtime.setConnectedMode(false);
  }
}

function bindStatus(bag: NudgeBag, instance: PubSub): void {
  bag.lastStatus = instance.status();
  if (bag.lastStatus === 'connected') {
    bag.options.runtime.setConnectedMode(true);
  }
  bag.unbindStatus = instance.onStatus((next) => onStatus(bag, next));
}

function disposeBag(bag: NudgeBag): void {
  if (bag.disposed) return;
  bag.disposed = true;
  bag.options.runtime.setConnectedMode(false);
  clearTopicState(bag);
  if (bag.coalesceTrailing !== null) clearTimeout(bag.coalesceTrailing);
  bag.coalesceTrailing = null;
  bag.pendingSweep = null;
  bag.coalesceInWindow = false;
  bag.unbindStatus?.();
  bag.unbindStatus = null;
  for (const d of bag.disposers) d();
  bag.disposers.length = 0;
}

/**
 * Subscribes to query-derived pubsub topics and schedules refetches via
 * SubscriptionRuntime wakeScope. Removing this wiring leaves the shared
 * FALLBACK_POLL_MS / RECONCILE_MS cadence as the only freshness path.
 */
export function attachNudges(options: AttachNudgesOptions): () => void {
  const bag = createBag(options);
  options.onPubSubInstance?.(bag.pubsub);
  options.onScheduleWakeAll?.(() => scheduleWakeAllDebounced(bag));
  options.onBindTopicRefresh?.(() => {
    if (!bag.disposed) syncTopics(bag);
  });
  if (options.onTablesChanged !== undefined) {
    bag.disposers.push(
      options.onTablesChanged((tables) => {
        if (bag.disposed) return;
        if (!tables.has('spaces') && !tables.has('space_users')) return;
        syncTopics(bag);
      })
    );
  }
  bindStatus(bag, bag.pubsub);
  syncTopics(bag);
  seedBirthTopics(bag);
  bag.disposers.push(
    options.runtime.onSubscriptionsChange(() => syncTopics(bag))
  );
  return () => disposeBag(bag);
}
