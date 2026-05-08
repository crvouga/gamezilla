import { assert } from '@gamezilla/lib/assert';
import type { Logger } from '@gamezilla/lib/logger';
import type { PubSub } from '@gamezilla/lib/pub-sub/interface';
import type { Patch, PatchDb, PatchDbQuery } from '../interface';
import {
  OPEN_PATCHES_DB_CONTEXT,
  PATCH_REJECTED,
  PATCH_SYNC_REJECTED_AT,
  PATCH_SYNC_REJECTED_REASON,
  PATCH_SYNCED_AT,
} from '../interface';
import type { PatchDbTransportRejectedError } from '../transport/transport-rejected-error';
import { PATCHES_DB_TOPIC } from './active-query-registry';

/** Patches that still need a successful remote push. */
export function unsyncedPatchesQueryForPush(): PatchDbQuery {
  return {
    on: 'patches',
    where: {
      type: 'and',
      clauses: [
        { type: 'not_exists', attribute: PATCH_SYNCED_AT },
        { type: 'not_exists', attribute: PATCH_SYNC_REJECTED_AT },
      ],
    },
  };
}

function pushRejectionAttributes(reason: string): Record<string, unknown> {
  const now = new Date().toISOString();
  return {
    [PATCH_SYNC_REJECTED_AT]: now,
    [PATCH_SYNC_REJECTED_REASON]: reason.slice(0, 256),
    [PATCH_REJECTED]: true,
  };
}

/**
 * After 401/403 on a push chunk: mark patches rejected locally. They stay in
 * the DB but are ignored for entity materialization and are not retried as
 * outbox work until {@link clearRejectedPushMarkersOnLocal} clears the markers.
 */
export async function discardTransportRejectedChunk(args: {
  local: PatchDb;
  chunk: readonly Patch[];
  err: PatchDbTransportRejectedError;
  pubSub: PubSub;
  log: Logger;
  logPushPollFailures: boolean;
}): Promise<void> {
  const { local, chunk, err, pubSub, log, logPushPollFailures } = args;
  const reason = `${String(err.status)}: transport rejected`;
  await local.update(
    chunk.map((p) => ({
      patchId: p.patchId,
      attributes: pushRejectionAttributes(reason),
    })),
    OPEN_PATCHES_DB_CONTEXT
  );
  pubSub.publish(PATCHES_DB_TOPIC, { type: 'invalidated' });
  if (logPushPollFailures) {
    log.info('marked local patches rejected after transport rejection', {
      count: chunk.length,
      status: err.status,
    });
  }
}

/**
 * Clears push-rejection markers on local patches (e.g. after sign-in) so the
 * next push can retry them.
 */
export async function clearRejectedPushMarkersOnLocal(
  local: PatchDb,
  pubSub: PubSub
): Promise<void> {
  const [result] = await local.read(
    [
      {
        on: 'patches',
        where: {
          type: 'or',
          clauses: [
            { type: 'exists', attribute: PATCH_SYNC_REJECTED_AT },
            { type: '=', attribute: PATCH_REJECTED, value: true },
          ],
        },
      },
    ],
    OPEN_PATCHES_DB_CONTEXT
  );
  assert.ok(
    result !== null && result !== undefined,
    'read([query]) must return one result'
  );
  if (result.patches.length === 0) return;
  await local.update(
    result.patches.map((p) => ({
      patchId: p.patchId,
      attributes: {
        [PATCH_SYNC_REJECTED_AT]: null,
        [PATCH_SYNC_REJECTED_REASON]: null,
        [PATCH_REJECTED]: null,
      },
    })),
    OPEN_PATCHES_DB_CONTEXT
  );
  pubSub.publish(PATCHES_DB_TOPIC, { type: 'invalidated' });
}
