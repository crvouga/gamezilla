import type { Topic } from '@pkgs/pubsub-root-shared-ts/topic';
import { warnPush } from '@pkgs/sync-engine-shared-ts/is-pubsub-closed-error';
import type { PushAppliedClock } from '@pkgs/sync-engine-shared-ts/push-applied';
import {
  compareCheckpoint,
  isContiguousNext,
  raiseScopeCheckpoints,
  readLastPushSeq,
  recordPushApplied,
} from '@pkgs/sync-engine-shared-ts/push-applied';
import type { PushMessage, QueryRow } from '@pkgs/sync-engine-shared-ts/v2';
import { rowsWithinReceiveCap } from './attach-push-rows-cap';
import type { RowImageCheckpointRaise } from './merge';
import { applyRowImages } from './merge';
import type { PushSubscriptions } from './push-subscriptions';
import { filterScopesByTables, parsePush } from './push-subscriptions';

/**
 * Local rows already reflect this push (row images applied, or the pushSeq
 * was consumed by an earlier apply / own upload ack). Fence the topic's
 * scopes at the push checkpoint so an older in-flight snapshot is dropped.
 */
async function fenceScopesAtPush(
  bag: PushSubscriptions,
  topic: Topic,
  payload: PushMessage
): Promise<void> {
  if (payload.checkpoint === undefined) return;
  const scopes = bag.topicToScopes.get(topic);
  if (scopes === undefined || scopes.size === 0) return;
  try {
    await raiseScopeCheckpoints(
      bag.options.db,
      [...scopes],
      payload.checkpoint,
      { now: bag.options.now }
    );
  } catch (error) {
    warnPush('[push] scope checkpoint fence failed', topic, error);
  }
}

function raiseFor(
  bag: PushSubscriptions,
  topic: Topic,
  payload: PushMessage
): { readonly raise: RowImageCheckpointRaise } | Record<string, never> {
  const scopes = bag.topicToScopes.get(topic);
  if (payload.checkpoint === undefined || scopes === undefined) return {};
  return { raise: { checkpoint: payload.checkpoint, scopes: [...scopes] } };
}

async function tryApplyFanoutRows(
  bag: PushSubscriptions,
  topic: Topic,
  payload: PushMessage
): Promise<boolean> {
  if (bag.options.rowImageFanout !== true) return false;
  if (payload.rows === undefined) return false;
  const capped = rowsWithinReceiveCap(payload.rows);
  if (capped === undefined) return false;
  const getMergeDeps = bag.options.getMergeDeps;
  if (getMergeDeps === undefined) return false;

  const clock: PushAppliedClock = { now: bag.options.now };
  const last = await readLastPushSeq(bag.options.db, topic, clock);
  if (!isContiguousNext(last, payload.pushSeq)) return false;

  try {
    await applyRowImages(
      getMergeDeps(),
      capped as Record<string, readonly QueryRow[]>,
      raiseFor(bag, topic, payload)
    );
    await recordPushApplied(bag.options.db, topic, payload.pushSeq, clock);
    return true;
  } catch (error) {
    warnPush('[push] row fanout apply failed; falling back', topic, error);
    return false;
  }
}

/** pushSeq already recorded (fanout apply or upload ack floor) — consume without re-applying rows. */
function isDuplicatePushSeq(lastPushSeq: string, pushSeq: string): boolean {
  return compareCheckpoint(pushSeq, lastPushSeq) === 0;
}

function wakeRefetch(
  bag: PushSubscriptions,
  topic: Topic,
  payload: PushMessage,
  scopes: Set<string>
): void {
  bag.pendingTopicPushSeqs.set(topic, payload.pushSeq);
  if (scopes.size === 1) {
    bag.options.runtime.wakeScope([...scopes][0]!);
    return;
  }
  bag.options.runtime.wakeScopes([...scopes]);
}

export async function handlePush(
  bag: PushSubscriptions,
  topic: Topic,
  data: unknown
): Promise<void> {
  if (bag.disposed) return;
  const payload = parsePush(data);
  if (payload === null) return;
  const topicScopes = bag.topicToScopes.get(topic);
  if (topicScopes === undefined) return;
  if (payload.optimistic === true) {
    // Peer hints have no authoritative order. Their rows may predate content
    // already shown, so they wake a snapshot; committed pushes still apply rows.
    const scopes = filterScopesByTables(bag, topicScopes, payload.tables);
    if (scopes.size > 0) bag.options.runtime.wakeScopes([...scopes]);
    return;
  }

  let lastPushSeq: string | null;
  const clock: PushAppliedClock = { now: bag.options.now };
  try {
    lastPushSeq = await readLastPushSeq(bag.options.db, topic, clock);
  } catch (error) {
    warnPush('[push] pushSeq check failed', topic, error);
    return;
  }

  if (
    lastPushSeq !== null &&
    (isDuplicatePushSeq(lastPushSeq, payload.pushSeq) ||
      compareCheckpoint(payload.pushSeq, lastPushSeq) <= 0)
  ) {
    // Already applied (fanout / refetch) or floored by our own upload ack —
    // local rows hold these writes, so the fence is sound.
    await fenceScopesAtPush(bag, topic, payload);
    return;
  }

  const scopes = filterScopesByTables(bag, topicScopes, payload.tables);
  if (scopes.size === 0) return;
  if (await tryApplyFanoutRows(bag, topic, payload)) return;
  wakeRefetch(bag, topic, payload, scopes);
}

export async function commitPendingPushSeqs(
  bag: PushSubscriptions,
  sweptScopes: readonly string[]
): Promise<void> {
  if (bag.pendingTopicPushSeqs.size === 0) return;
  const swept = new Set(sweptScopes);
  for (const [topic, pushSeq] of [...bag.pendingTopicPushSeqs]) {
    const topicScopes = bag.topicToScopes.get(topic);
    if (topicScopes === undefined) {
      bag.pendingTopicPushSeqs.delete(topic);
      continue;
    }
    let overlap = false;
    for (const scope of topicScopes) {
      if (swept.has(scope)) {
        overlap = true;
        break;
      }
    }
    if (!overlap) continue;
    try {
      await recordPushApplied(bag.options.db, topic, pushSeq, {
        now: bag.options.now,
      });
    } catch (error) {
      warnPush('[push] recordPushApplied failed', topic, error);
    }
    bag.pendingTopicPushSeqs.delete(topic);
  }
}
