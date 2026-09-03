import type { Action, CatalogProperty, Repro, System } from '@pkgs/dst';
import { REPRO_VERSION, replay } from '@pkgs/dst';

import {
  type SyncSystemDef,
  syncVirtualHost,
} from './define-sync-system';
import type { SyncKnobs } from './knobs';

/** Replay an algebra repro (choices name algebra actions). */
export async function replaySyncRepro(
  def: SyncSystemDef,
  repro: Repro | string
) {
  return replay(def as unknown as System<unknown, SyncKnobs>, repro, {
    host: syncVirtualHost(),
    properties: def.properties as readonly CatalogProperty<unknown>[],
    actions: def.actions as readonly Action<unknown>[],
  });
}

export function syncRepro(
  seed: number,
  choices: Repro['choices'],
  knobs: unknown = null
): Repro {
  return {
    version: REPRO_VERSION,
    seed,
    knobs,
    choices,
    meta: { system: 'sync' },
  };
}
