import { AssertCrashError, assert } from '@pkgs/assert';
import type { Logger } from '@pkgs/logger';
import type { PubSub } from '@pkgs/pub-sub/interface';
import type { Patch, PatchDb, WritePatchesResult } from '../interface';
import {
  OPEN_PATCHES_DB_CONTEXT,
  PATCH_REJECTED,
  PATCH_SYNC_REJECTED_AT,
  PATCH_SYNC_REJECTED_REASON,
  PATCH_SYNCED_AT,
  toAttributeState,
} from '../interface';
import { PatchDbTransportRejectedError } from '../transport/transport-rejected-error';
import {
  publishServerWriteAccepted,
  publishServerWriteError,
  publishServerWriteTransportRejected,
} from './impl-sync-server-write-log';
import {
  discardTransportRejectedChunk,
  unsyncedPatchesQueryForPush,
} from './impl-sync-rejected-pushes';
import { SYNC_ERROR_TOPIC, type SyncErrorEvent } from './impl-sync-topics';

const MAX_CONSECUTIVE_FAILURES = 5;

export function assertChunkMatchesWriteResult(
  chunk: readonly Patch[],
  result: WritePatchesResult
): void {
  assert.ok(
    result.accepted.length + result.rejected.length === chunk.length,
    'remote.write must account for every patch in chunk',
    {
      chunk: chunk.length,
      accepted: result.accepted.length,
      rejected: result.rejected.length,
    }
  );
  const ids = new Set(chunk.map((p) => p.patchId));
  for (const p of result.accepted) {
    assert.ok(ids.has(p.patchId), 'accepted patchId must be from chunk');
  }
  for (const r of result.rejected) {
    assert.ok(ids.has(r.patchId), 'rejected patchId must be from chunk');
  }
}

export async function applyChunkPushWriteResult(
  local: PatchDb,
  result: WritePatchesResult
): Promise<void> {
  const now = new Date().toISOString();
  const updates = [
    ...result.accepted.map((p) => ({
      patchId: p.patchId,
      attributes: toAttributeState({ [PATCH_SYNCED_AT]: '1' }),
    })),
    ...result.rejected.map((r) => ({
      patchId: r.patchId,
      attributes: toAttributeState({
        [PATCH_SYNC_REJECTED_AT]: now,
        [PATCH_SYNC_REJECTED_REASON]:
          `${String(r.code)}: ${String(r.reason)}`.slice(0, 256),
        [PATCH_REJECTED]: true,
      }),
    })),
  ];
  if (updates.length > 0) {
    await local.update(updates, OPEN_PATCHES_DB_CONTEXT);
  }
}

export type SyncPushDeps = {
  readonly local: PatchDb;
  readonly remote: PatchDb;
  readonly pubSub: PubSub;
  readonly log: Logger;
  readonly logPushPollFailures: boolean;
  readonly maxPushBatchSize: number;
  isDestroyed: () => boolean;
  getPushConsecutiveFailures: () => number;
  setPushConsecutiveFailures: (n: number) => void;
  assertChunkMatchesWriteResult: (
    chunk: readonly Patch[],
    result: WritePatchesResult
  ) => void;
  applyChunkPushWriteResult: (result: WritePatchesResult) => Promise<void>;
  poll: () => Promise<void>;
  /** When true, patch is dropped from the outbox (marked synced) before push. */
  shouldQuarantinePatchBeforePush?: (patch: Patch) => boolean;
  quarantinePatchesBeforePush?: (patchIds: readonly string[]) => Promise<void>;
};

export async function filterQuarantinedPatchesBeforePush(
  deps: SyncPushDeps,
  patches: readonly Patch[]
): Promise<readonly Patch[]> {
  const shouldQuarantine = deps.shouldQuarantinePatchBeforePush;
  const quarantine = deps.quarantinePatchesBeforePush;
  if (
    shouldQuarantine === undefined ||
    quarantine === undefined ||
    patches.length === 0
  ) {
    return patches;
  }
  const drop = patches.filter(shouldQuarantine);
  if (drop.length === 0) return patches;
  await quarantine(drop.map((patch) => patch.patchId));
  return patches.filter((patch) => !shouldQuarantine(patch));
}

function onPushFailure(deps: SyncPushDeps, err: unknown): void {
  if (err instanceof AssertCrashError) {
    throw err;
  }
  deps.setPushConsecutiveFailures(deps.getPushConsecutiveFailures() + 1);
  if (deps.logPushPollFailures) {
    deps.log.error('push failed', {
      error: err instanceof Error ? err.message : String(err),
      consecutiveFailures: deps.getPushConsecutiveFailures(),
    });
  }
  if (deps.getPushConsecutiveFailures() >= MAX_CONSECUTIVE_FAILURES) {
    deps.pubSub.publish(SYNC_ERROR_TOPIC, {
      source: 'push',
      error: err,
    } satisfies SyncErrorEvent);
  }
}

export async function pushUnsyncedChunksThenPoll(
  deps: SyncPushDeps,
  patches: readonly Patch[],
  opts: { strictRejections?: boolean } = {}
): Promise<void> {
  const batchSize = deps.maxPushBatchSize;
  const strict = opts.strictRejections === true;
  for (let i = 0; i < patches.length; i += batchSize) {
    if (deps.isDestroyed()) return;
    const chunk = patches.slice(i, i + batchSize);
    try {
      const writeResult = await deps.remote.write(
        chunk,
        OPEN_PATCHES_DB_CONTEXT
      );
      deps.assertChunkMatchesWriteResult(chunk, writeResult);
      await deps.applyChunkPushWriteResult(writeResult);
      publishServerWriteAccepted(
        deps.pubSub,
        chunk,
        writeResult.accepted.length,
        writeResult.rejected
      );
      if (strict && writeResult.rejected.length > 0) {
        const detail = writeResult.rejected
          .map((r) => r.reason || r.code)
          .join('; ');
        throw new Error(detail.length > 0 ? detail : 'patch push rejected');
      }
    } catch (chunkErr) {
      if (chunkErr instanceof PatchDbTransportRejectedError) {
        publishServerWriteTransportRejected(deps.pubSub, chunk, chunkErr);
        await discardTransportRejectedChunk({
          local: deps.local,
          chunk,
          err: chunkErr,
          pubSub: deps.pubSub,
          log: deps.log,
          logPushPollFailures: deps.logPushPollFailures,
        });
        deps.setPushConsecutiveFailures(0);
        if (strict) {
          throw chunkErr;
        }
        return;
      }
      publishServerWriteError(deps.pubSub, chunk, chunkErr);
      throw chunkErr;
    }
  }
  await deps.poll();
}

export async function pushUnsynced(deps: SyncPushDeps): Promise<void> {
  if (deps.isDestroyed()) return;
  try {
    const [result] = await deps.local.read(
      [unsyncedPatchesQueryForPush()],
      OPEN_PATCHES_DB_CONTEXT
    );
    assert.ok(
      result !== null && result !== undefined,
      'read([query]) must return one result'
    );
    const patches = await filterQuarantinedPatchesBeforePush(
      deps,
      result.patches
    );
    if (patches.length === 0) {
      deps.setPushConsecutiveFailures(0);
      return;
    }
    await pushUnsyncedChunksThenPoll(deps, patches);
  } catch (err) {
    onPushFailure(deps, err);
  }
}
