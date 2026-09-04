import type { Topic } from '@pkgs/pubsub/interface';

import type { QueryRow } from '../queries/core/types';
import { warnPush } from '../shared/is-pubsub-closed-error';
import type { PushMessage } from '../shared/push-payload';
import { filterAcceptableImages } from '../shared/row-image-guard';
import type { TopicMapCtx } from '../shared/topic-map';
import {
  filterScopesByTables,
  type PushBag,
  parsePush,
} from './attach-push-bag';
import { rowsWithinReceiveCap } from './attach-push-rows-cap';
import { applyRowImages } from './merge';
import {
  compareCheckpoint,
  isContiguousNext,
  type PushAppliedClock,
  readLastPushSeq,
  recordPushApplied,
} from './push-applied';

function topicMapCtxFromBag(bag: PushBag): TopicMapCtx {
  const channels = bag.options.getChannelsCtx();
  return {
    actorId: channels.actorId,
    deviceId: '',
    accountId: null,
    isAnon: false,
  };
}

async function tryApplyOptimisticRows(
  bag: PushBag,
  topic: Topic,
  payload: PushMessage
): Promise<boolean> {
  if (payload.optimistic !== true) return false;
  if (bag.options.rowImageFanout !== true || payload.rows === undefined) {
    return true;
  }
  const capped = rowsWithinReceiveCap(payload.rows);
  if (capped === undefined) return true;
  const getMergeDeps = bag.options.getMergeDeps;
  if (getMergeDeps === undefined) return true;
  try {
    const rows = await filterAcceptableImages(
      bag.options.db,
      capped as Record<string, readonly QueryRow[]>,
      bag.options.topicMap,
      topicMapCtxFromBag(bag)
    );
    if (Object.keys(rows).length === 0) return true;
    await applyRowImages(getMergeDeps(), rows, { optimistic: true });
  } catch (error) {
    warnPush('[push] optimistic fanout apply failed', topic, error);
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
      capped as Record<string, readonly QueryRow[]>
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
  const clock: PushAppliedClock = { now: bag.options.now };
  try {
    lastPushSeq = await readLastPushSeq(bag.options.db, topic, clock);
  } catch (error) {
    warnPush('[push] pushSeq check failed', topic, error);
    return;
  }

  if (
    lastPushSeq !== null &&
    isDuplicatePushSeq(lastPushSeq, payload.pushSeq)
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
      await recordPushApplied(bag.options.db, topic, pushSeq, {
        now: bag.options.now,
      });
    } catch (error) {
      warnPush('[push] recordPushApplied failed', topic, error);
    }
    bag.pendingTopicPushSeqs.delete(topic);
  }
}
