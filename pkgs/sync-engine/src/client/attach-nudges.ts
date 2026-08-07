import type { PubSub, PubSubStatus, Topic } from '@pkgs/pubsub/interface';
import { sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';

import {
  type AttachNudgesOptions,
  createNudgeBag,
  type NudgeBag,
} from './attach-nudges-bag';
import { commitPendingCheckpoints, handleNudge } from './attach-nudges-handle';
import { clearRemovedTopicApplied } from './topic-applied';

export type { AttachNudgesOptions } from './attach-nudges-bag';

async function countPendingMutations(db: SqlClient): Promise<number> {
  const rows = await db.query(sql<{ c: number | string }>`
    SELECT COUNT(*) AS c FROM _mutations
  `);
  return Number(rows[0]?.c ?? 0);
}

function scheduleMembershipRemake(bag: NudgeBag): void {
  bag.membershipRemakePending = true;
  void flushMembershipRemake(bag);
}

async function flushMembershipRemake(bag: NudgeBag): Promise<void> {
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
  bag.options.onPubSubChanged?.(bag.pubsub);
  bag.lastTopicKey = topicKey(desired);
  bindStatus(bag, bag.pubsub);
  for (const [topic, scopes] of desired) {
    bag.topicToScopes.set(topic, scopes);
    try {
      const unsub = bag.pubsub.subscribe(topic, (data) => {
        void handleNudge(bag, topic, data);
      });
      bag.topicUnsubs.set(topic, unsub);
    } catch (error) {
      console.warn('[nudges] subscribe failed', topic, error);
    }
  }
  void clearRemovedTopicApplied(bag.options.db, new Set(desired.keys())).catch(
    (error) => {
      console.warn('[nudges] clearRemovedTopicApplied failed', error);
    }
  );
}

function syncTopics(bag: NudgeBag): void {
  if (bag.disposed) return;
  const desired = collectDesiredTopics(bag);
  const nextKey = topicKey(desired);
  if (nextKey === bag.lastTopicKey && bag.topicUnsubs.size === desired.size) {
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
 * topic is subscribed at birth (no late-topic timers). Membership remakes
 * wait until `_mutations` is idle so upload fanout is not lost mid-reconnect.
 */
export function attachNudges(options: AttachNudgesOptions): () => void {
  const bag = createNudgeBag(options);
  options.runtime.setAfterSweep((scopes) => {
    void commitPendingCheckpoints(bag, scopes);
  });
  options.onBindTopicRefresh?.(() => {
    if (!bag.disposed) scheduleMembershipRemake(bag);
  });
  if (options.onTablesChanged !== undefined) {
    bag.disposers.push(
      options.onTablesChanged((tables) => {
        if (bag.disposed) return;
        if (tables.has('spaces') || tables.has('space_users')) {
          scheduleMembershipRemake(bag);
        }
        if (tables.has('_mutations')) {
          void flushMembershipRemake(bag);
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
