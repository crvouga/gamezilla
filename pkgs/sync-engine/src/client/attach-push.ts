import type { PubSub, PubSubStatus, Topic } from '@pkgs/pubsub/interface';
import { sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';

import {
  type AttachPushOptions,
  createPushBag,
  type PushBag,
} from './attach-push-bag';
import { commitPendingPushSeqs, handlePush } from './attach-push-handle';
import { clearRemovedPushApplied } from './push-applied';

export type { AttachPushOptions } from './attach-push-bag';

async function countPendingMutations(db: SqlClient): Promise<number> {
  const rows = await db.query(sql<{ c: number | string }>`
    SELECT COUNT(*) AS c FROM _mutations
  `);
  return Number(rows[0]?.c ?? 0);
}

function scheduleMembershipSync(bag: PushBag): void {
  bag.membershipRemakePending = true;
  void flushMembershipSync(bag);
}

async function flushMembershipSync(bag: PushBag): Promise<void> {
  if (bag.disposed || !bag.membershipRemakePending || bag.remakeFlushInFlight) {
    return;
  }
  bag.remakeFlushInFlight = true;
  try {
    const pending = await countPendingMutations(bag.options.db);
    if (bag.disposed) return;
    if (pending > 0) {
      // Stay pending; retry only when `_mutations` bus fires (do not recurse).
      return;
    }
    bag.membershipRemakePending = false;
    syncTopics(bag);
  } finally {
    bag.remakeFlushInFlight = false;
  }
}

function collectDesiredTopics(bag: PushBag): Map<Topic, Set<string>> {
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

function clearTopicState(bag: PushBag): void {
  for (const unsub of bag.topicUnsubs.values()) unsub();
  bag.topicUnsubs.clear();
  bag.topicToScopes.clear();
}

function subscribeTopic(bag: PushBag, topic: Topic): void {
  try {
    const unsub = bag.pubsub.subscribe(topic, (data) => {
      void handlePush(bag, topic, data);
    });
    bag.topicUnsubs.set(topic, unsub);
  } catch (error) {
    console.warn('[push] subscribe failed', topic, error);
  }
}

/**
 * Full pubsub remake — only for initial attach. Membership churn must NOT
 * call this: close() wipes the MQTT session (sessionExpiry 0) and drops
 * in-flight peer creates during reconnect.
 */
function remake(bag: PushBag, desired: Map<Topic, Set<string>>): void {
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
  bag.options.onPubSubChanged?.(bag.pubsub);
  bag.lastTopicKey = topicKey(desired);
  bindStatus(bag, bag.pubsub);
  for (const [topic, scopes] of desired) {
    bag.topicToScopes.set(topic, scopes);
    subscribeTopic(bag, topic);
  }
  void clearRemovedPushApplied(bag.options.db, new Set(desired.keys())).catch(
    (error) => {
      console.warn('[push] clearRemovedPushApplied failed', error);
    }
  );
}

/**
 * Incremental topic sync — keep the MQTT connection alive. Add/remove
 * subscriptions in place so peer pushes during membership churn are not lost.
 */
function syncTopicsIncremental(
  bag: PushBag,
  desired: Map<Topic, Set<string>>
): void {
  let changed = false;

  for (const topic of [...bag.topicUnsubs.keys()]) {
    if (desired.has(topic)) continue;
    bag.topicUnsubs.get(topic)?.();
    bag.topicUnsubs.delete(topic);
    bag.topicToScopes.delete(topic);
    changed = true;
  }

  for (const [topic, scopes] of desired) {
    bag.topicToScopes.set(topic, scopes);
    if (bag.topicUnsubs.has(topic)) continue;
    subscribeTopic(bag, topic);
    changed = true;
  }

  bag.lastTopicKey = topicKey(desired);
  void clearRemovedPushApplied(bag.options.db, new Set(desired.keys())).catch(
    (error) => {
      console.warn('[push] clearRemovedPushApplied failed', error);
    }
  );

  // Heal any push lost in the tiny subscribe race without tearing down MQTT.
  if (changed) bag.options.runtime.wakeAll();
}

function syncTopics(bag: PushBag): void {
  if (bag.disposed) return;
  const desired = collectDesiredTopics(bag);
  const nextKey = topicKey(desired);
  if (nextKey === bag.lastTopicKey && bag.topicUnsubs.size === desired.size) {
    for (const [topic, scopes] of desired) {
      bag.topicToScopes.set(topic, scopes);
    }
    return;
  }
  syncTopicsIncremental(bag, desired);
}

function onStatus(bag: PushBag, next: PubSubStatus): void {
  if (bag.disposed) return;
  const prev = bag.lastStatus;
  bag.lastStatus = next;
  if (next === 'connected' && prev !== 'connected') {
    bag.options.runtime.wakeAll();
  }
}

function bindStatus(bag: PushBag, instance: PubSub): void {
  bag.lastStatus = instance.status();
  bag.unbindStatus = instance.onStatus((next) => onStatus(bag, next));
}

function disposeBag(bag: PushBag): void {
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
 * Initial bind remakes pubsub once. Later membership / subscription changes
 * sync topics incrementally (no session wipe). Membership sync waits until
 * `_mutations` is idle so upload fanout is not racing topic updates.
 */
export function attachPush(options: AttachPushOptions): () => void {
  const bag = createPushBag(options);
  options.runtime.setAfterSweep((scopes) => {
    void commitPendingPushSeqs(bag, scopes);
  });
  options.onBindTopicRefresh?.(() => {
    if (!bag.disposed) scheduleMembershipSync(bag);
  });
  if (options.onTablesChanged !== undefined) {
    bag.disposers.push(
      options.onTablesChanged((tables) => {
        if (bag.disposed) return;
        if (tables.has('spaces') || tables.has('space_users')) {
          scheduleMembershipSync(bag);
        }
        if (tables.has('_mutations')) {
          void flushMembershipSync(bag);
        }
      })
    );
  }
  remake(bag, collectDesiredTopics(bag));
  bag.disposers.push(
    options.runtime.onSubscriptionsChange(() => syncTopics(bag))
  );
  return () => disposeBag(bag);
}
