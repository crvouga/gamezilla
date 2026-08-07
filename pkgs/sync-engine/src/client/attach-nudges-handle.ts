import type { Topic } from '@pkgs/pubsub/interface';

import type { QueryRow } from '../queries/core/types';
import type { NudgePayload } from '../shared/nudge-payload';
import {
  filterScopesByTables,
  type NudgeBag,
  parseNudge,
} from './attach-nudges-bag';
import { applyRowImages } from './merge';
import {
  compareCheckpoint,
  isContiguousNext,
  readTopicLastApplied,
  recordTopicApplied,
} from './topic-applied';

async function tryApplyOptimisticRows(
  bag: NudgeBag,
  topic: Topic,
  payload: NudgePayload
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
    console.warn('[nudges] optimistic fanout apply failed', topic, error);
  }
  return true;
}

async function tryApplyFanoutRows(
  bag: NudgeBag,
  topic: Topic,
  payload: NudgePayload
): Promise<boolean> {
  if (bag.options.rowImageFanout !== true) return false;
  if (payload.rows === undefined) return false;
  const getMergeDeps = bag.options.getMergeDeps;
  if (getMergeDeps === undefined) return false;

  const last = await readTopicLastApplied(bag.options.db, topic);
  if (!isContiguousNext(last, payload.checkpoint)) return false;

  try {
    await applyRowImages(
      getMergeDeps(),
      payload.rows as Record<string, readonly QueryRow[]>
    );
    await recordTopicApplied(bag.options.db, topic, payload.checkpoint);
    return true;
  } catch (error) {
    console.warn(
      '[nudges] row fanout apply failed; falling back',
      topic,
      error
    );
    return false;
  }
}

async function tryApplyExactEcho(
  bag: NudgeBag,
  topic: Topic,
  payload: NudgePayload,
  lastApplied: string
): Promise<boolean> {
  if (
    compareCheckpoint(payload.checkpoint, lastApplied) !== 0 ||
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
    console.warn(
      '[nudges] echo fanout apply failed; falling back',
      topic,
      error
    );
    return false;
  }
}

function wakeRefetch(
  bag: NudgeBag,
  topic: Topic,
  payload: NudgePayload,
  scopes: Set<string>
): void {
  bag.pendingTopicCheckpoints.set(topic, payload.checkpoint);
  if (scopes.size === 1) {
    bag.options.runtime.wakeScope([...scopes][0]!);
    return;
  }
  bag.options.runtime.wakeScopes([...scopes]);
}

export async function handleNudge(
  bag: NudgeBag,
  topic: Topic,
  data: unknown
): Promise<void> {
  if (bag.disposed) return;
  const payload = parseNudge(data);
  if (payload === null) return;
  const topicScopes = bag.topicToScopes.get(topic);
  if (topicScopes === undefined) return;
  if (await tryApplyOptimisticRows(bag, topic, payload)) return;

  let lastApplied: string | null;
  try {
    lastApplied = await readTopicLastApplied(bag.options.db, topic);
  } catch (error) {
    console.warn('[nudges] checkpoint check failed', topic, error);
    return;
  }

  if (
    lastApplied !== null &&
    (await tryApplyExactEcho(bag, topic, payload, lastApplied))
  ) {
    return;
  }
  if (
    lastApplied !== null &&
    compareCheckpoint(payload.checkpoint, lastApplied) <= 0
  ) {
    return;
  }

  const scopes = filterScopesByTables(bag, topicScopes, payload.tables);
  if (scopes.size === 0) return;
  if (await tryApplyFanoutRows(bag, topic, payload)) return;
  wakeRefetch(bag, topic, payload, scopes);
}

export async function commitPendingCheckpoints(
  bag: NudgeBag,
  sweptScopes: readonly string[]
): Promise<void> {
  if (bag.pendingTopicCheckpoints.size === 0) return;
  const swept = new Set(sweptScopes);
  for (const [topic, checkpoint] of [...bag.pendingTopicCheckpoints]) {
    const topicScopes = bag.topicToScopes.get(topic);
    if (topicScopes === undefined) {
      bag.pendingTopicCheckpoints.delete(topic);
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
      await recordTopicApplied(bag.options.db, topic, checkpoint);
    } catch (error) {
      console.warn('[nudges] recordTopicApplied failed', topic, error);
    }
    bag.pendingTopicCheckpoints.delete(topic);
  }
}
