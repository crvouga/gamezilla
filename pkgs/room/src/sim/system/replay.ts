import type { AnySystemDef, JsonValue, SystemAction } from '@pkgs/determinism';
import { replay } from '@pkgs/determinism/pbt';

import type { RoomSystemAction } from './actions';
import type { RoomSystemDef, RoomSystemWorld } from './define-room-system';
import type { RoomWorldKnobs } from './knobs';

export type ReplayRoomInputs = {
  readonly seed: number | bigint | string;
  readonly knobs?: Partial<RoomWorldKnobs>;
  readonly actions: readonly RoomSystemAction[];
  /** Default true — run the system settle (converge) assertion. */
  readonly settle?: boolean;
};

/**
 * `replay` with room-typed actions and knobs. Room domain ops carry
 * `args: Record<string, unknown>`, so the wire cast lives here once.
 */
export async function replayRoom(
  def: RoomSystemDef,
  inputs: ReplayRoomInputs
): Promise<RoomSystemWorld> {
  const { world } = await replay(def as unknown as AnySystemDef, {
    seed: inputs.seed,
    actions: inputs.actions as unknown as readonly SystemAction[],
    ...(inputs.knobs !== undefined
      ? { knobs: inputs.knobs as Partial<Record<string, JsonValue>> }
      : {}),
    ...(inputs.settle !== undefined ? { settle: inputs.settle } : {}),
  });
  return world as unknown as RoomSystemWorld;
}

/** Replay a scripted pin, then dispose. */
export async function replayRoomPin(
  def: RoomSystemDef,
  inputs: ReplayRoomInputs
): Promise<void> {
  const world = await replayRoom(def, inputs);
  await world.dispose();
}
