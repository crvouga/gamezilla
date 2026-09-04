import type { Script } from '@pkgs/dst';
import {
  applyTaggedRoomAction,
  type RoomArgs,
  type RoomSurface,
  type RoomSystemAction,
  type RoomSystemDef,
} from '../../sim/scenario';
import { expectConverged } from '../expect-converged';
import { openRoom } from './open-room';

export type PlayRoomActionsOpts = {
  readonly seed: number | bigint | string;
  readonly args?: Partial<RoomArgs>;
  readonly actions: readonly RoomSystemAction[];
  /** Default true — revive + wait for domain agreement after the script. */
  readonly converge?: boolean;
};

/**
 * Open a room script, apply tagged actions via `s.apply`, optionally converge.
 * Test helper for PBT pins that still speak {@link RoomSystemAction}.
 */
export async function playRoomActions(
  def: RoomSystemDef,
  opts: PlayRoomActionsOpts
): Promise<Script<RoomSurface>> {
  const args = opts.args;
  const s = await openRoom(def, {
    seed: opts.seed,
    clientCount: args?.clientCount ?? 2,
    mildFaults: args?.mildFaults === true,
  });
  for (const action of opts.actions) {
    await applyTaggedRoomAction(s, action);
  }
  if (opts.converge !== false) {
    await expectConverged(s);
  }
  return s;
}

/** Play then dispose — for pins that only need converge-or-throw. */
export async function playRoomPin(
  def: RoomSystemDef,
  opts: PlayRoomActionsOpts
): Promise<void> {
  await using _s = await playRoomActions(def, opts);
}
