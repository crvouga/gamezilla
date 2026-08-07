import type { Topic } from '@pkgs/pubsub/interface';

import type { QueryRow } from '../queries/core/types';
import type { PushMessage } from '../shared/push-payload';
import {
  filterScopesByTables,
  type PushBag,
  parsePush,
} from './attach-push-bag';
import { applyRowImages } from './merge';
import {
  compareCheckpoint,
  isContiguousNext,
  readLastPushSeq,
  recordPushApplied,
} from './push-applied';

async function tryApplyOptimisticRows(
  bag: PushBag,
  topic: Topic,
  payload: PushMessage
): Promise<boolean> {
  if (payload.optimistic !== true) return false;
  if (bag.options.rowImageFanout !== true || payload.rows === undefined) {
    return true;
  }
  const getMergeDeps = bag.options.getMergeDeps;
  if (getMergeDeps === undefined) return true;
  try {
    await applyRowImages(
      getMergeDeps(),
      payload.rows as Record<string, readonly QueryRow[]>
    );
  } catch (error) {
    console.warn('[push] optimistic fanout apply failed', topic, error);
  }
  return true;
}

async function tryApplyFanoutRows(
  bag: PushBag,
  topic: Topic,
  payload: PushMessage
): Promise<boolean> {
  if (bag.options.rowImageFanout !== true) return false;
  if (payload.rows === undefined) return false;
  const getMergeDeps = bag.options.getMergeDeps;
  if (getMergeDeps === undefined) return false;

  const last = await readLastPushSeq(bag.options.db, topic);
  if (!isContiguousNext(last, payload.pushSeq)) return false;

  try {
    await applyRowImages(
      getMergeDeps(),
      payload.rows as Record<string, readonly QueryRow[]>
    );
    await recordPushApplied(bag.options.db, topic, payload.pushSeq);
    return true;
  } catch (error) {
    console.warn('[push] row fanout apply failed; falling back', topic, error);
    return false;
  }
}

async function tryApplyExactEcho(
  bag: PushBag,
  topic: Topic,
  payload: PushMessage,
  lastPushSeq: string
): Promise<boolean> {
  if (
    compareCheckpoint(payload.pushSeq, lastPushSeq) !== 0 ||
    payload.rows === undefined ||
    bag.options.rowImageFanout !== true ||
    bag.options.getMergeDeps === undefined
  ) {
    return false;
  }
  try {
    await applyRowImages(
      bag.options.getMergeDeps(),
      payload.rows as Record<string, readonly QueryRow[]>
    );
    return true;
  } catch (error) {
    console.warn('[push] echo fanout apply failed; falling back', topic, error);
    return false;
  }
}

function wakeRefetch(
  bag: PushBag,
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
  bag: PushBag,
  topic: Topic,
  data: unknown
): Promise<void> {
  if (bag.disposed) return;
  const payload = parsePush(data);
  if (payload === null) return;
  const topicScopes = bag.topicToScopes.get(topic);
  if (topicScopes === undefined) return;
  if (await tryApplyOptimisticRows(bag, topic, payload)) return;

  let lastPushSeq: string | null;
  try {
    lastPushSeq = await readLastPushSeq(bag.options.db, topic);
  } catch (error) {
    console.warn('[push] pushSeq check failed', topic, error);
    return;
  }

  if (
    lastPushSeq !== null &&
    (await tryApplyExactEcho(bag, topic, payload, lastPushSeq))
  ) {
    return;
  }
  if (
    lastPushSeq !== null &&
    compareCheckpoint(payload.pushSeq, lastPushSeq) <= 0
  ) {
    return;
  }

  const scopes = filterScopesByTables(bag, topicScopes, payload.tables);
  if (scopes.size === 0) return;
  if (await tryApplyFanoutRows(bag, topic, payload)) return;
  wakeRefetch(bag, topic, payload, scopes);
}

export async function commitPendingPushSeqs(
  bag: PushBag,
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
      await recordPushApplied(bag.options.db, topic, pushSeq);
    } catch (error) {
      console.warn('[push] recordPushApplied failed', topic, error);
    }
    bag.pendingTopicPushSeqs.delete(topic);
  }
}
