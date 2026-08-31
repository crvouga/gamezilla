import type { Topic } from '@pkgs/pubsub/interface';
import { sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';

import type { QueryRow } from '../queries/core/types';
import { warnPush } from '../shared/is-pubsub-closed-error';
import type { PushMessage } from '../shared/push-payload';
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
  const capped = rowsWithinReceiveCap(payload.rows);
  if (capped === undefined) return true;
  const getMergeDeps = bag.options.getMergeDeps;
  if (getMergeDeps === undefined) return true;
  try {
    const rows = await dropRegressiveProfileImages(
      bag.options.db,
      capped as Record<string, readonly QueryRow[]>
    );
    if (Object.keys(rows).length === 0) return true;
    await applyRowImages(getMergeDeps(), rows, { optimistic: true });
  } catch (error) {
    warnPush('[push] optimistic fanout apply failed', topic, error);
  }
  return true;
}

/** Never blank a peer's assigned username with an empty ensureProfile seed. */
async function dropRegressiveProfileImages(
  db: SqlClient,
  rows: Record<string, readonly QueryRow[]>
): Promise<Record<string, readonly QueryRow[]>> {
  const profiles = rows['profile'];
  if (profiles === undefined) return rows;
  const kept: QueryRow[] = [];
  for (const row of profiles) {
    const id = row['id'];
    const username = row['username'];
    const empty =
      username == null ||
      (typeof username === 'string' && username.length === 0);
    if (!empty || typeof id !== 'string') {
      kept.push(row);
      continue;
    }
    const existing = await db.query(sql<{ username: string | null }>`
      SELECT username FROM profile WHERE id = ${id} LIMIT 1
    `);
    const local = existing[0]?.username;
    if (typeof local === 'string' && local.length > 0) {
      continue;
    }
    kept.push(row);
  }
  if (kept.length === profiles.length) return rows;
  const next: Record<string, readonly QueryRow[]> = { ...rows };
  if (kept.length === 0) {
    delete next['profile'];
  } else {
    next['profile'] = kept;
  }
  return next;
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

  const last = await readLastPushSeq(bag.options.db, topic);
  if (!isContiguousNext(last, payload.pushSeq)) return false;

  try {
    await applyRowImages(
      getMergeDeps(),
      capped as Record<string, readonly QueryRow[]>
    );
    await recordPushApplied(bag.options.db, topic, payload.pushSeq);
    return true;
  } catch (error) {
    warnPush('[push] row fanout apply failed; falling back', topic, error);
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
  const capped = rowsWithinReceiveCap(payload.rows);
  if (capped === undefined) return false;
  try {
    await applyRowImages(
      bag.options.getMergeDeps(),
      capped as Record<string, readonly QueryRow[]>
    );
    return true;
  } catch (error) {
    warnPush('[push] echo fanout apply failed; falling back', topic, error);
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
    warnPush('[push] pushSeq check failed', topic, error);
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
      warnPush('[push] recordPushApplied failed', topic, error);
    }
    bag.pendingTopicPushSeqs.delete(topic);
  }
}
