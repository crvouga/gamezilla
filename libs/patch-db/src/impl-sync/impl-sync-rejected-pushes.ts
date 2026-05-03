import { assert } from '@gamezilla/lib/assert';
import type { Logger } from '@gamezilla/lib/logger';
import type { PubSub } from '@gamezilla/lib/pub-sub/interface';
import type { Patch, PatchesDb, PatchesDbQuery } from '../interface';
import {
  OPEN_PATCHES_DB_CONTEXT,
  PATCH_SYNC_REJECTED_AT,
  PATCH_SYNC_REJECTED_REASON,
} from '../interface';
import { PatchDbTransportRejectedError } from '../transport/transport-rejected-error';
import { PATCHES_DB_TOPIC } from './active-query-registry';

/** Patches that still need a successful remote push (excludes server-rejected). */
export function unsyncedPatchesQueryForPush(): PatchesDbQuery {
  return {
    on: 'patches',
    where: {
      type: 'and',
      clauses: [
        { type: 'not_exists', attribute: 'patch/syncedAt' },
        { type: 'not_exists', attribute: PATCH_SYNC_REJECTED_AT },
      ],
    },
  };
}

export async function markPatchesRejectedByServer(args: {
  local: PatchesDb;
  chunk: readonly Patch[];
  err: PatchDbTransportRejectedError;
  pubSub: PubSub;
  log: Logger;
  logPushPollFailures: boolean;
}): Promise<void> {
  const { local, chunk, err, pubSub, log, logPushPollFailures } = args;
  const now = new Date().toISOString();
  const reason = `${String(err.status)}: ${err.message}`.slice(0, 256);
  await local.update(
    chunk.map((p) => ({
      patchId: p.patchId,
      attributes: {
        [PATCH_SYNC_REJECTED_AT]: now,
        [PATCH_SYNC_REJECTED_REASON]: reason,
      },
    })),
    OPEN_PATCHES_DB_CONTEXT
  );
  pubSub.publish(PATCHES_DB_TOPIC, { type: 'invalidated' });
  if (logPushPollFailures) {
    log.info('patches abandoned by server', {
      count: chunk.length,
      status: err.status,
    });
  }
}

export async function clearRejectedPushMarkersOnLocal(
  local: PatchesDb,
  pubSub: PubSub
): Promise<void> {
  const [result] = await local.read(
    [
      {
        on: 'patches',
        where: { type: 'exists', attribute: PATCH_SYNC_REJECTED_AT },
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
      },
    })),
    OPEN_PATCHES_DB_CONTEXT
  );
  pubSub.publish(PATCHES_DB_TOPIC, { type: 'invalidated' });
}
