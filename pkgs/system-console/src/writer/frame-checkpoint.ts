import type { ObjectStore } from '@pkgs/object-store/interface';

import type { SimulationFrameCheckpoint } from '../types';
import { testFrameKey } from './keys';
import { padFrame } from './reporter-helpers';
import { storePutJson } from './store-io';

export type SnapshotCheckpointMeta = Omit<SimulationFrameCheckpoint, 'file'>;

export async function writeFrameCheckpoint(args: {
  readonly store: ObjectStore;
  readonly runId: string;
  readonly testId: string;
  readonly frameSeq: number;
  readonly snapshotCheckpoint?: () =>
    | SnapshotCheckpointMeta
    | Promise<SnapshotCheckpointMeta>;
}): Promise<SimulationFrameCheckpoint | undefined> {
  if (args.snapshotCheckpoint === undefined) return undefined;
  let meta: SnapshotCheckpointMeta;
  try {
    meta = await args.snapshotCheckpoint();
  } catch {
    return undefined;
  }
  const file = `frames/f-${padFrame(args.frameSeq)}.checkpoint.json`;
  const key = testFrameKey(args.runId, args.testId, file);
  const checkpoint: SimulationFrameCheckpoint = { file, ...meta };
  await storePutJson(args.store, key, checkpoint);
  return checkpoint;
}
