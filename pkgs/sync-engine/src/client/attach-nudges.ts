import type { PubSub, PubSubStatus, Topic } from '@pkgs/pubsub/interface';
import { sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';
import type { QueryRegistry } from '@pkgs/sync-engine/queries/core/types';
import type {
  NudgePayload,
  QueryChannelsCtx,
} from '@pkgs/sync-engine/shared/nudge-payload';

import type { SubscriptionRuntime } from './subscription-runtime';

const DEFAULT_DEBOUNCE_MS = 150;
const DEFAULT_LATE_TOPIC_REMAKE_MS = 10_000;
const STATUS_POLL_JITTER_MS = 5_000;

export type AttachNudgesOptions = {
  readonly pubsub: PubSub;
  readonly runtime: SubscriptionRuntime;
  readonly queryRegistry: QueryRegistry;
  readonly db: SqlClient;
  readonly getChannelsCtx: () => QueryChannelsCtx;
  readonly remakePubSub: () => PubSub;
  readonly debounceMs?: number;
  readonly lateTopicRemakeMs?: number;
  /** When set, upload-ack refreshes coalesce through the same debounce path. */
  readonly onScheduleWakeAll?: (wakeAll: () => void) => void;
};

type DebounceState = {
  trailing: ReturnType<typeof setTimeout> | null;
  inWindow: boolean;
};

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
  readonly topicUnsubs: Map<Topic, () => void>;
  readonly topicToScopes: Map<Topic, Set<string>>;
  readonly debounceByScope: Map<string, DebounceState>;
  readonly lateTopics: Map<Topic, ReturnType<typeof setTimeout>>;
  readonly topicsAtInstanceBirth: Set<Topic>;
  readonly disposers: Array<() => void>;
};

function parseNudge(data: unknown): NudgePayload | null {
  if (data === null || typeof data !== 'object') return null;
  const record = data as Record<string, unknown>;
  if (!('checkpoint' in record)) return {};
  if (record['checkpoint'] === undefined) return {};
  if (typeof record['checkpoint'] !== 'string') return null;
  return { checkpoint: record['checkpoint'] };
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
    topicUnsubs: new Map(),
    topicToScopes: new Map(),
    debounceByScope: new Map(),
    lateTopics: new Map(),
    topicsAtInstanceBirth: new Set(),
    disposers: [],
  };
}

function scheduleRefetch(bag: NudgeBag, scope: string): void {
  let state = bag.debounceByScope.get(scope);
  if (state === undefined) {
    state = { trailing: null, inWindow: false };
    bag.debounceByScope.set(scope, state);
  }
  if (!state.inWindow) {
    state.inWindow = true;
    bag.options.runtime.wakeScope(scope);
    state.trailing = setTimeout(() => {
      state!.inWindow = false;
      state!.trailing = null;
    }, bag.debounceMs);
    return;
  }
  if (state.trailing !== null) clearTimeout(state.trailing);
  state.trailing = setTimeout(() => {
    bag.options.runtime.wakeScope(scope);
    state!.inWindow = false;
    state!.trailing = null;
  }, bag.debounceMs);
}

function scheduleWakeAllDebounced(bag: NudgeBag): void {
  for (const sub of bag.options.runtime.listActive()) {
    scheduleRefetch(bag, sub.scope);
  }
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
  return checkpoint <= last;
}

function handleNudge(bag: NudgeBag, topic: Topic, data: unknown): void {
  if (bag.disposed) return;
  const payload = parseNudge(data);
  if (payload === null) return;
  const scopes = bag.topicToScopes.get(topic);
  if (scopes === undefined) return;
  for (const scope of scopes) {
    const checkpoint = payload.checkpoint;
    if (checkpoint === undefined) {
      scheduleRefetch(bag, scope);
      continue;
    }
    void shouldSkipCheckpoint(bag, scope, checkpoint).then((skip) => {
      if (!skip && !bag.disposed) scheduleRefetch(bag, scope);
    });
  }
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
    if (prev === 'down') {
      bag.options.runtime.wakeAllWithJitter(STATUS_POLL_JITTER_MS);
    }
    return;
  }
  if (next === 'down') {
    bag.options.runtime.setConnectedMode(false);
    bag.options.runtime.wakeAllWithJitter(STATUS_POLL_JITTER_MS);
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
  for (const state of bag.debounceByScope.values()) {
    if (state.trailing !== null) clearTimeout(state.trailing);
  }
  bag.debounceByScope.clear();
  bag.unbindStatus?.();
  bag.unbindStatus = null;
  for (const d of bag.disposers) d();
  bag.disposers.length = 0;
}

/**
 * Subscribes to query-derived pubsub topics and schedules refetches via the
 * existing SubscriptionRuntime poll path. Removing this wiring must leave
 * polling correctness unchanged.
 */
export function attachNudges(options: AttachNudgesOptions): () => void {
  const bag = createBag(options);
  options.onScheduleWakeAll?.(() => scheduleWakeAllDebounced(bag));
  bindStatus(bag, bag.pubsub);
  syncTopics(bag);
  seedBirthTopics(bag);
  bag.disposers.push(
    options.runtime.onSubscriptionsChange(() => syncTopics(bag))
  );
  return () => disposeBag(bag);
}
