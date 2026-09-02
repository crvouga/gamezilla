import type { AnyScenarioDef, Command, JsonValue } from '@pkgs/dst';
import { replay } from '@pkgs/dst/pbt';

import type { RoomSystemAction } from './actions';
import type { RoomSystemDef, RoomSystemWorld } from './define-room-system';
import type { RoomWorldKnobs } from './knobs';

export type ReplayRoomInputs = {
  readonly seed: number | bigint | string;
  readonly knobs?: Partial<RoomWorldKnobs>;
  readonly commands: readonly RoomSystemAction[];
  /** Default true — run the scenario converge assertion. */
  readonly converge?: boolean;
};

/**
 * `replay` with room-typed actions and knobs. Room domain ops carry
 * `args: Record<string, unknown>`, so the wire cast lives here once.
 */
export async function replayRoom(
  def: RoomSystemDef,
  inputs: ReplayRoomInputs
): Promise<RoomSystemWorld> {
  const { world } = await replay(def as unknown as AnyScenarioDef, {
    seed: inputs.seed,
    commands: inputs.commands as unknown as readonly Command[],
    ...(inputs.knobs !== undefined
      ? { knobs: inputs.knobs as Partial<Record<string, JsonValue>> }
      : {}),
    ...(inputs.converge !== undefined ? { converge: inputs.converge } : {}),
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
