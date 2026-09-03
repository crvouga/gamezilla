import type { Run } from '@pkgs/dst';
import { untilObserved } from '@pkgs/dst';
import type { RoomSystemAction } from './actions';
import { applyRoomAction } from './apply-room-action';
import type { RoomSystemDef } from './define-room-system';
import type { RoomKnobs } from './knobs';
import { converged } from './observations';
import { passTime, revive } from './room-actions';
import { startRoom } from './start-room';
import type { RoomSurface } from './surface';

export type ReplayRoomInputs = {
  readonly seed: number | bigint | string;
  readonly knobs?: Partial<RoomKnobs>;
  readonly actions: readonly RoomSystemAction[];
  /** Default true — revive + wait for domain agreement after the script. */
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
  for (const action of inputs.actions) {
    await applyRoomAction(run, action);
  }
  if (inputs.converge !== false) {
    await run.apply(revive);
    await untilObserved(run, converged, passTime, {
      stepMs: 25,
      maxMs: 15_000,
    });
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
