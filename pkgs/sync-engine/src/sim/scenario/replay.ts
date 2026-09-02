import type { AnyScenarioDef, Command, JsonValue } from '@pkgs/dst';
import { replay } from '@pkgs/dst/pbt';

import type { SyncAction } from './actions';
import type { SyncSystemDef, SyncSystemWorld } from './define-sync-system';
import type { WorldKnobs } from './knobs';

export type ReplaySyncInputs = {
  readonly seed: number | bigint | string;
  readonly knobs?: Partial<WorldKnobs>;
  readonly commands: readonly SyncAction[];
  /** Default true — run the scenario converge assertion. */
  readonly converge?: boolean;
};

/**
 * `replay` with sync-typed actions and knobs. Sync actions carry
 * `args: Record<string, unknown>`, so the wire cast lives here once.
 */
export async function replaySync(
  def: SyncSystemDef,
  inputs: ReplaySyncInputs
): Promise<SyncSystemWorld> {
  const { world } = await replay(def as unknown as AnyScenarioDef, {
    seed: inputs.seed,
    commands: inputs.commands as unknown as readonly Command[],
    ...(inputs.knobs !== undefined
      ? { knobs: inputs.knobs as Partial<Record<string, JsonValue>> }
      : {}),
    ...(inputs.converge !== undefined ? { converge: inputs.converge } : {}),
  });
  return world as unknown as SyncSystemWorld;
}

/** Replay a scripted pin, then dispose. */
export async function replaySyncPin(
  def: SyncSystemDef,
  inputs: ReplaySyncInputs
): Promise<void> {
  const world = await replaySync(def, inputs);
  await world.dispose();
}
