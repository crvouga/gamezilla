/**
 * In-memory playground World checkpoint capture / restore.
 */

import type { CheckpointSessionCtx } from '@apps/client/host/playground-checkpoint-state';
import {
  applyCheckpointFaults,
  collectFaultFields,
  collectRooms,
  collectSqlAndKv,
  importCheckpointSql,
  resetSimClock,
  restoreCheckpointKv,
  restoreCheckpointRooms,
} from '@apps/client/host/playground-checkpoint-state';
import { awaitPlaygroundMutationDrain } from '@apps/client/host/playground-snapshot-sync';
import { getLocalSchemaTargetVersion } from '@pkgs/sync-engine/client';
import type { SystemCheckpoint } from '@pkgs/system-console/client';

export type { CheckpointSessionCtx } from '@apps/client/host/playground-checkpoint-state';

export async function captureCheckpoint(
  ctx: CheckpointSessionCtx,
  label?: string
): Promise<SystemCheckpoint> {
  const clientIds = [...ctx.maps.clients.keys()];
  const roomTopics = [...ctx.roomNode.listTopics()];
  await awaitPlaygroundMutationDrain(ctx, clientIds);
  const blobs = await collectSqlAndKv(ctx, clientIds);
  const capturedAtMs = ctx.clock.now();
  return {
    label: label?.trim() || 'notify',
    capturedAtMs,
    clockMs: capturedAtMs,
    clockPaused: ctx.getClockPaused(),
    localSchemaVersion: getLocalSchemaTargetVersion(),
    clientIds,
    roomTopics,
    ...collectFaultFields(ctx),
    sqlFormat: 'sqlm',
    ...blobs,
    rooms: collectRooms(ctx, roomTopics),
  };
}

export async function restoreCheckpoint(
  ctx: CheckpointSessionCtx,
  checkpoint: SystemCheckpoint
): Promise<void> {
  if (checkpoint.sqlFormat !== 'sqlm') {
    throw new Error(
      `restoreCheckpoint: expected sqlm blobs, got '${checkpoint.sqlFormat}'`
    );
  }
  ctx.setClockPaused(true);
  try {
    await ctx.detachClientsForSnapshotLoad();
    await ctx.runQuiet(async () => {
      ctx.sim.bumpClientEpoch();
      restoreCheckpointKv(checkpoint);
      await importCheckpointSql(ctx, checkpoint);
      await restoreCheckpointRooms(ctx, checkpoint);
      applyCheckpointFaults(ctx.sim, checkpoint);
      resetSimClock(ctx.clock, checkpoint.clockMs);
      ctx.setClockPaused(checkpoint.clockPaused);
      ctx.endSnapshotRestoring();
    });
  } catch (err) {
    ctx.endSnapshotRestoring();
    ctx.notify();
    throw err;
  }
}
