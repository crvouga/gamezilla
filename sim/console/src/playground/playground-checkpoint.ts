/**
 * In-memory playground World checkpoint capture / restore.
 */

import type { SimCheckpoint } from '@pkgs/sim-console/client';
import { getLocalSchemaTargetVersion } from '@pkgs/sync-engine/client';
import type { CheckpointSessionCtx } from '@sim/console/playground/playground-checkpoint-state';
import {
  applyCheckpointFaults,
  collectFaultFields,
  collectRooms,
  collectSqlAndKv,
  importCheckpointSql,
  resetSimClock,
  restoreCheckpointKv,
  restoreCheckpointRooms,
} from '@sim/console/playground/playground-checkpoint-state';
import { awaitPlaygroundMutationDrain } from '@sim/console/playground/playground-snapshot-sync';
import { getSimSqlFabric } from '@sim/console/sim/sim-sql-fabric';

export type { CheckpointSessionCtx } from '@sim/console/playground/playground-checkpoint-state';

export async function captureCheckpoint(
  ctx: CheckpointSessionCtx,
  label?: string
): Promise<SimCheckpoint> {
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
    sqlFormat: getSimSqlFabric().checkpointSqlFormat,
    ...blobs,
    rooms: collectRooms(ctx, roomTopics),
  };
}

export async function restoreCheckpoint(
  ctx: CheckpointSessionCtx,
  checkpoint: SimCheckpoint
): Promise<void> {
  const expected = getSimSqlFabric().checkpointSqlFormat;
  if (checkpoint.sqlFormat === 'sqlm') {
    throw new Error(
      'restoreCheckpoint: legacy all-sqlm checkpoints are incompatible with the current server SQL fabric'
    );
  }
  if (checkpoint.sqlFormat !== expected) {
    throw new Error(
      `restoreCheckpoint: checkpoint sqlFormat '${checkpoint.sqlFormat}' does not match active fabric '${expected}' (clear sticky snapshot or switch SIM_SQL_BACKEND)`
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
      resetSimClock(ctx.clock, ctx.scheduler, checkpoint.clockMs);
      ctx.setClockPaused(checkpoint.clockPaused);
      ctx.endSnapshotRestoring();
    });
  } catch (err) {
    ctx.endSnapshotRestoring();
    ctx.notify();
    throw err;
  }
}
