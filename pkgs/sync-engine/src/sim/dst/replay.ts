import type { DstAction as FrameworkAction, JsonValue } from '@pkgs/dst';
import { replayDst } from '@pkgs/dst/pbt';

import type { DstAction } from './actions';
import type { SyncDstDef, SyncDstWorld } from './define-sync-dst';
import type { WorldKnobs } from './knobs';

export type ReplaySyncInputs = {
  readonly seed: number | bigint | string;
  readonly knobs?: Partial<WorldKnobs>;
  readonly actions: readonly DstAction[];
  /** Default true — run the system settle (converge) assertion. */
  readonly settle?: boolean;
};

/**
 * `replayDst` with sync-typed actions and knobs. Sync actions carry
 * `args: Record<string, unknown>`, so the wire cast lives here once.
 */
export async function replaySyncDst(
  def: SyncDstDef,
  inputs: ReplaySyncInputs
): Promise<SyncDstWorld> {
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
export async function replaySyncPin(
  def: SyncDstDef,
  inputs: ReplaySyncInputs
): Promise<void> {
  const world = await replaySyncDst(def, inputs);
  await world.dispose();
}
