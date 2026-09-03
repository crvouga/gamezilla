import type { Action, Repro } from '@pkgs/dst';
import { REPRO_VERSION } from '@pkgs/dst';
import { check, replay } from '@pkgs/dst/pbt';

import { type SyncSystemDef, syncVirtualHost } from './define-sync-system';

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
