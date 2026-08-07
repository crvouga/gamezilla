import type { PubSub, PubSubStatus, Topic } from '@pkgs/pubsub/interface';

import type { QueryRegistry } from '../queries/core/types';
import type { NudgePayload, QueryChannelsCtx } from '../shared/nudge-payload';
import { REAL_TIMERS, type Timers } from './sim-ports';
import type { SubscriptionRuntime } from './subscription-runtime';

export type AttachNudgesOptions = {
  readonly pubsub: PubSub;
  readonly runtime: SubscriptionRuntime;
  readonly queryRegistry: QueryRegistry;
  readonly getChannelsCtx: () => QueryChannelsCtx;
  readonly remakePubSub: () => PubSub;
  readonly timers?: Timers;
  /** Register a callback to re-derive MQTT topics after channels ctx changes. */
  readonly onBindTopicRefresh?: (refresh: () => void) => void;
  /** Re-sync topics when membership tables change locally. */
  readonly onTablesChanged?: (
    listener: (tables: ReadonlySet<string>) => void
  ) => () => void;
};

type NudgeBag = {
  readonly options: AttachNudgesOptions;
  readonly timers: Timers;
  pubsub: PubSub;
  disposed: boolean;
  lastStatus: PubSubStatus;
  unbindStatus: (() => void) | null;
  readonly topicUnsubs: Map<Topic, () => void>;
  readonly topicToScopes: Map<Topic, Set<string>>;
  readonly disposers: Array<() => void>;
  /** Sorted topic key of the last remake — skip remake when unchanged. */
  lastTopicKey: string;
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
    timers: options.timers ?? REAL_TIMERS,
    pubsub: options.pubsub,
    disposed: false,
    lastStatus: options.pubsub.status(),
    unbindStatus: null,
    topicUnsubs: new Map(),
    topicToScopes: new Map(),
    disposers: [],
    lastTopicKey: '',
  };
}

function handleNudge(bag: NudgeBag, topic: Topic, data: unknown): void {
  if (bag.disposed) return;
  const payload = parseNudge(data);
  if (payload === null) return;
  const topicScopes = bag.topicToScopes.get(topic);
  if (topicScopes === undefined) return;
  const scopes = filterScopesByTables(bag, topicScopes, payload.tables);
  if (scopes.size === 0) return;
  if (scopes.size === 1) {
    bag.options.runtime.wakeScope([...scopes][0]!);
    return;
  }
  bag.options.runtime.wakeScopes([...scopes]);
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

function topicKey(desired: Map<Topic, Set<string>>): string {
  return [...desired.keys()].sort().join('\0');
}

function clearTopicState(bag: NudgeBag): void {
  for (const unsub of bag.topicUnsubs.values()) unsub();
  bag.topicUnsubs.clear();
  bag.topicToScopes.clear();
}

function remake(bag: NudgeBag, desired: Map<Topic, Set<string>>): void {
  if (bag.disposed) return;
  clearTopicState(bag);
  bag.unbindStatus?.();
  bag.unbindStatus = null;
  try {
    bag.pubsub.close();
  } catch {
    // ignore
  }
  bag.pubsub = bag.options.remakePubSub();
  bag.lastTopicKey = topicKey(desired);
  bindStatus(bag, bag.pubsub);
  for (const [topic, scopes] of desired) {
    bag.topicToScopes.set(topic, scopes);
    try {
      const unsub = bag.pubsub.subscribe(topic, (data) =>
        handleNudge(bag, topic, data)
      );
      bag.topicUnsubs.set(topic, unsub);
    } catch (error) {
      console.warn('[nudges] subscribe failed', topic, error);
    }
  }
}

function syncTopics(bag: NudgeBag): void {
  if (bag.disposed) return;
  const desired = collectDesiredTopics(bag);
  const nextKey = topicKey(desired);
  if (nextKey === bag.lastTopicKey && bag.topicUnsubs.size === desired.size) {
    // Same topics — only refresh scope membership maps.
    for (const [topic, scopes] of desired) {
      bag.topicToScopes.set(topic, scopes);
    }
    return;
  }
  remake(bag, desired);
}

function onStatus(bag: NudgeBag, next: PubSubStatus): void {
  if (bag.disposed) return;
  const prev = bag.lastStatus;
  bag.lastStatus = next;
  if (next === 'connected' && prev !== 'connected') {
    bag.options.runtime.wakeAll();
  }
}

function bindStatus(bag: NudgeBag, instance: PubSub): void {
  bag.lastStatus = instance.status();
  bag.unbindStatus = instance.onStatus((next) => onStatus(bag, next));
}

function disposeBag(bag: NudgeBag): void {
  if (bag.disposed) return;
  bag.disposed = true;
  clearTopicState(bag);
  bag.unbindStatus?.();
  bag.unbindStatus = null;
  for (const d of bag.disposers) d();
  bag.disposers.length = 0;
}

/**
 * Subscribes to query-derived pubsub topics and wakes SubscriptionRuntime.
 * When the desired topic set changes, remakes the pubsub instance so every
 * topic is subscribed at birth (no late-topic timers).
 */
export function attachNudges(options: AttachNudgesOptions): () => void {
  const bag = createBag(options);
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
  remake(bag, collectDesiredTopics(bag));
  bag.disposers.push(
    options.runtime.onSubscriptionsChange(() => syncTopics(bag))
  );
  return () => disposeBag(bag);
}
