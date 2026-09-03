import type { Run } from '@pkgs/dst';
import {
  applyTaggedRoomAction,
  type RoomKnobs,
  type RoomSystemAction,
  type RoomSystemDef,
  type RoomSurface,
} from '../../sim/scenario';
import { expectConverged } from '../expect-converged';
import { openRoom } from './open-room';

export type PlayRoomActionsOpts = {
  readonly seed: number | bigint | string;
  readonly knobs?: Partial<RoomKnobs>;
  readonly actions: readonly RoomSystemAction[];
  /** Default true — revive + wait for domain agreement after the script. */
  readonly converge?: boolean;
};

/**
 * Open a room run, apply tagged actions via `run.apply`, optionally converge.
 * Test helper for PBT pins that still speak {@link RoomSystemAction}.
 */
export async function playRoomActions(
  def: RoomSystemDef,
  opts: PlayRoomActionsOpts
): Promise<Run<RoomSurface>> {
  const knobs = opts.knobs;
  const run = await openRoom(def, {
    seed: opts.seed,
    clientCount: knobs?.clientCount ?? 2,
    mildFaults: knobs?.mildFaults === true,
  });
  for (const action of opts.actions) {
    await applyTaggedRoomAction(run, action);
  }
  if (opts.converge !== false) {
    await expectConverged(run);
  }
  return run;
}

/** Play then dispose — for pins that only need converge-or-throw. */
export async function playRoomPin(
  def: RoomSystemDef,
  opts: PlayRoomActionsOpts
): Promise<void> {
  await using _run = await playRoomActions(def, opts);
}
