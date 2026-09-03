import type { Action, Repro } from '@pkgs/dst';
import { REPRO_VERSION } from '@pkgs/dst';
import { check, replay } from '@pkgs/dst/pbt';

import { applyActionToShadow } from './action-shadow';
import type { SyncAction } from './actions';
import {
  openSyncWorld,
  playSyncActions,
  SYNC_STEP_MS,
  type SyncSystemDef,
  syncVirtualHost,
} from './define-sync-system';
import type { WorldKnobs } from './knobs';
import { replayStep } from './play';

export type ReplaySyncInputs = {
  readonly seed: number | bigint | string;
  readonly knobs?: Partial<WorldKnobs>;
  readonly actions: readonly SyncAction[];
  /** Default true — prepare converge + assertConverged after actions. */
  readonly converge?: boolean;
};

/**
 * Scripted pin: open world, apply SyncAction objects, optionally converge.
 */
export async function replaySyncPin(
  def: SyncSystemDef,
  inputs: ReplaySyncInputs
): Promise<void> {
  await using world = await openSyncWorld(def, {
    seed: inputs.seed,
    ...(inputs.knobs !== undefined ? { knobs: inputs.knobs } : {}),
  });
  if (inputs.converge === false) {
    for (const action of inputs.actions) {
      await replayStep({
        world,
        app: world.runtime.app,
        action,
        state: world.runtime.replay,
      });
      applyActionToShadow(world.runtime.app, world.shadow, action);
      await world.checkInvariants();
      await world.advance(SYNC_STEP_MS);
    }
    return;
  }
  await playSyncActions(world, inputs.actions);
  await world.assertConverged();
}

/** Check campaign wrapper with sync host + system action/property catalogs. */
export async function checkSync(
  def: SyncSystemDef,
  opts?: {
    readonly episodes?: number;
    readonly steps?: number;
    readonly seed?: number;
    readonly draws?: readonly unknown[];
  }
) {
  return check(def, {
    host: syncVirtualHost(),
    properties: def.properties,
    actions: def.actions,
    ...(opts?.episodes !== undefined ? { episodes: opts.episodes } : {}),
    ...(opts?.steps !== undefined ? { steps: opts.steps } : {}),
    ...(opts?.seed !== undefined ? { seed: opts.seed } : {}),
    ...(opts?.draws !== undefined ? { draws: opts.draws } : {}),
  });
}

/** Replay an algebra repro (choices name algebra actions). */
export async function replaySyncRepro(
  def: SyncSystemDef,
  repro: Repro | string
) {
  return replay(def, repro, {
    host: syncVirtualHost(),
    properties: def.properties,
    actions: def.actions as readonly Action<unknown>[],
  });
}

export function syncRepro(
  seed: number,
  choices: Repro['choices'],
  systemDraws: readonly number[] = []
): Repro {
  return {
    version: REPRO_VERSION,
    seed,
    system: [...systemDraws],
    choices,
    meta: { system: 'sync' },
  };
}
