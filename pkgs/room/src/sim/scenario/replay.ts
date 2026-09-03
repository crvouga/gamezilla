import type { Run } from '@pkgs/dst';
import type { RoomSystemAction } from './actions';
import { playRoomActions } from './apply-room-action';
import type { RoomSystemDef } from './define-room-system';
import type { RoomWorldKnobs } from './knobs';
import { converge } from './room-actions';
import { startRoom } from './start-room';
import type { RoomSurface } from './surface';

export type ReplayRoomInputs = {
  readonly seed: number | bigint | string;
  readonly knobs?: Partial<RoomWorldKnobs>;
  readonly actions: readonly RoomSystemAction[];
  /** Default true — heal + converge after the script. */
  readonly converge?: boolean;
};

export async function replayRoom(
  def: RoomSystemDef,
  inputs: ReplayRoomInputs
): Promise<Run<RoomSurface>> {
  const knobs = inputs.knobs;
  const run = await startRoom(def, {
    seed: inputs.seed,
    clientCount: knobs?.clientCount ?? 2,
    mildFaults: knobs?.mildFaults === true,
  });
  await playRoomActions(run, inputs.actions);
  if (inputs.converge !== false) {
    await run.apply(converge);
  }
  return run;
}

/** Replay a scripted pin, then dispose. */
export async function replayRoomPin(
  def: RoomSystemDef,
  inputs: ReplayRoomInputs
): Promise<void> {
  await using _run = await replayRoom(def, inputs);
}
