import type { Action, Gen, Repro } from '@pkgs/dst';
import { explore, REPRO_VERSION, replay } from '@pkgs/dst';
import { gen } from '@pkgs/dst/fast-check';

import { type SyncSystemDef, syncVirtualHost } from './define-sync-system';
import { arbKnobs, type SyncKnobs } from './knobs';

/** Explore campaign wrapper with sync host + system action/property catalogs. */
export async function exploreSync(
  def: SyncSystemDef,
  opts?: {
    readonly episodes?: number;
    readonly steps?: number;
    readonly seed?: number;
    readonly knobs?: SyncKnobs | Gen<SyncKnobs>;
  }
) {
  return explore(def, {
    host: syncVirtualHost(),
    properties: def.properties,
    actions: def.actions,
    knobs: opts?.knobs ?? gen(arbKnobs()),
    ...(opts?.episodes !== undefined ? { episodes: opts.episodes } : {}),
    ...(opts?.steps !== undefined ? { steps: opts.steps } : {}),
    ...(opts?.seed !== undefined ? { seed: opts.seed } : {}),
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
  knobs: unknown = null,
  systemDraws: readonly number[] = []
): Repro {
  return {
    version: REPRO_VERSION,
    seed,
    system: [...systemDraws],
    knobs,
    choices,
    meta: { system: 'sync' },
  };
}
