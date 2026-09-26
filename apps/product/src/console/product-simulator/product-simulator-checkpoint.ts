/**
 * In-memory product-simulator run checkpoint capture / restore.
 */

import type { CheckpointSessionCtx } from '@libs/sim-harness/fabric/checkpoint-state';
import {
  applyCheckpointFaults,
  collectFaultFields,
  collectRooms,
  collectSqlAndKv,
  importCheckpointSql,
  resetSimClock,
  restoreCheckpointKv,
  restoreCheckpointRooms,
  restoreCheckpointServers,
} from '@libs/sim-harness/fabric/checkpoint-state';
import { getSimSqlEngines } from '@libs/sim-harness/fabric/sim-sql-engines';
import { awaitProductSimulatorMutationDrain } from '@libs/sim-harness/fabric/snapshot-sync';
import type { SimCheckpoint } from '@pkgs/sim-console/client';
import { getLocalSchemaTargetVersion } from '@pkgs/sync-engine/client';

export type { CheckpointSessionCtx } from '@libs/sim-harness/fabric/checkpoint-state';

export async function captureCheckpoint(
  ctx: CheckpointSessionCtx,
  label?: string
): Promise<SimCheckpoint> {
  const clientIds = [...ctx.maps.clients.keys()];
  const roomTopics = [...ctx.sim.roomNode.listTopics()];
  await awaitProductSimulatorMutationDrain(ctx, clientIds);
  const blobs = await collectSqlAndKv(ctx, clientIds);
  const capturedAtMs = ctx.clock.now();
  return {
    label: label?.trim() || 'notify',
    capturedAtMs,
    clockMs: capturedAtMs,
    clockPaused: ctx.getClockPaused(),
    localSchemaVersion: getLocalSchemaTargetVersion(),
    clientIds,
    serverIds: [...ctx.sim.serverIds()],
    roomTopics,
    ...collectFaultFields(ctx),
    sqlFormat: getSimSqlEngines().checkpointSqlFormat,
    ...blobs,
    rooms: collectRooms(ctx, roomTopics),
  };
}

export async function restoreCheckpoint(
  ctx: CheckpointSessionCtx,
  checkpoint: SimCheckpoint
): Promise<void> {
  const expected = getSimSqlEngines().checkpointSqlFormat;
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
      ctx.sim.bumpClientEpoch();
      await restoreCheckpointServers(ctx, checkpoint);
      restoreCheckpointKv(checkpoint);
      await importCheckpointSql(ctx, checkpoint);
      await restoreCheckpointRooms(ctx, checkpoint);
      applyCheckpointFaults(ctx.sim, checkpoint);
      resetSimClock(ctx.scheduler, checkpoint.clockMs);
      ctx.setClockPaused(checkpoint.clockPaused);
      ctx.endSnapshotRestoring();
    });
  } catch (err) {
    ctx.endSnapshotRestoring();
    ctx.notify();
    throw err;
  }
}
