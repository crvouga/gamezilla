import type { DstAction as FrameworkAction, JsonValue } from '@pkgs/dst';
import { replayDst } from '@pkgs/dst/pbt';

import type { RoomDstAction } from './actions';
import type { RoomDstDef, RoomDstWorld } from './define-room-dst';
import type { RoomWorldKnobs } from './knobs';

export type ReplayRoomInputs = {
  readonly seed: number | bigint | string;
  readonly knobs?: Partial<RoomWorldKnobs>;
  readonly actions: readonly RoomDstAction[];
  /** Default true — run the system settle (converge) assertion. */
  readonly settle?: boolean;
};

/**
 * `replayDst` with room-typed actions and knobs. Room domain ops carry
 * `args: Record<string, unknown>`, so the wire cast lives here once.
 */
export async function replayRoomDst(
  def: RoomDstDef,
  inputs: ReplayRoomInputs
): Promise<RoomDstWorld> {
  const { world } = await replayDst(def, {
    seed: inputs.seed,
    actions: inputs.actions as unknown as readonly FrameworkAction[],
    ...(inputs.knobs !== undefined
      ? { knobs: inputs.knobs as Partial<Record<string, JsonValue>> }
      : {}),
    ...(inputs.settle !== undefined ? { settle: inputs.settle } : {}),
  });
  return world;
}

/** Replay a scripted pin, then dispose. */
export async function replayRoomPin(
  def: RoomDstDef,
  inputs: ReplayRoomInputs
): Promise<void> {
  const world = await replayRoomDst(def, inputs);
  await world.dispose();
}
