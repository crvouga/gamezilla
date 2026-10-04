/**
 * In-memory product-harness run checkpoint capture / restore.
 */

import type { CheckpointSessionCtx } from '@libs/harness/checkpoint-state';
import {
  applyCheckpointFaults,
  collectFaultFields,
  collectRooms,
  collectSqlAndKv,
  importCheckpointSql,
  resetHarnessClock,
  restoreCheckpointKv,
  restoreCheckpointRooms,
  restoreCheckpointServers,
} from '@libs/harness/checkpoint-state';
import { awaitProductHarnessMutationDrain } from '@libs/harness/snapshot-sync';
import { getHarnessSqlEngines } from '@libs/harness/sql-engines';
import type { HarnessCheckpoint } from '@pkgs/harness-console-shared/checkpoint';
import { getLocalSchemaTargetVersion } from '@pkgs/sync-engine-client/local-schema-migrate';

export async function captureCheckpoint(
  ctx: CheckpointSessionCtx,
  label?: string
): Promise<HarnessCheckpoint> {
  const clientIds = [...ctx.maps.clients.keys()];
  const roomTopics = [...ctx.harness.roomNode.listTopics()];
  await awaitProductHarnessMutationDrain(ctx, clientIds);
  const blobs = await collectSqlAndKv(ctx, clientIds);
  const capturedAtMs = ctx.clock.now();
  return {
    label: label?.trim() || 'notify',
    capturedAtMs,
    clockMs: capturedAtMs,
    clockPaused: ctx.getClockPaused(),
    localSchemaVersion: getLocalSchemaTargetVersion(),
    clientIds,
    serverIds: [...ctx.harness.serverIds()],
    roomTopics,
    ...collectFaultFields(ctx),
    sqlFormat: getHarnessSqlEngines().checkpointSqlFormat,
    ...blobs,
    rooms: collectRooms(ctx, roomTopics),
  };
}

export async function restoreCheckpoint(
  ctx: CheckpointSessionCtx,
  checkpoint: HarnessCheckpoint
): Promise<void> {
  const expected = getHarnessSqlEngines().checkpointSqlFormat;
  if (checkpoint.sqlFormat === 'sqlm') {
    throw new Error(
      'restoreCheckpoint: legacy all-sqlm checkpoints are incompatible with the current server SQL fabric'
    );
  }
  if (checkpoint.sqlFormat !== expected) {
    throw new Error(
      `restoreCheckpoint: checkpoint sqlFormat '${checkpoint.sqlFormat}' does not match active fabric '${expected}' (clear sticky snapshot)`
    );
  }
  ctx.setClockPaused(true);
  try {
    await ctx.detachClientsForSnapshotLoad();
    await ctx.runQuiet(async () => {
      ctx.harness.bumpClientEpoch();
      await restoreCheckpointServers(ctx, checkpoint);
      restoreCheckpointKv(ctx, checkpoint);
      await importCheckpointSql(ctx, checkpoint);
      await restoreCheckpointRooms(ctx, checkpoint);
      applyCheckpointFaults(ctx.harness, checkpoint);
      resetHarnessClock(ctx.scheduler, checkpoint.clockMs);
      ctx.setClockPaused(checkpoint.clockPaused);
      ctx.endSnapshotRestoring();
    });
  } catch (err) {
    ctx.endSnapshotRestoring();
    ctx.notify();
    throw err;
  }
}
