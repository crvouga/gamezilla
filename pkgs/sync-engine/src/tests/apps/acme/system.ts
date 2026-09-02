import type { OpenWorldOptions } from '@pkgs/determinism';
import { openWorld } from '@pkgs/determinism';

import {
  defineSyncSystem,
  type SyncSystemDef,
  type SyncSystemWorld,
} from '../../../sim/scenario';
import type { SyncKnobDefs } from '../../../sim/scenario/knobs';
import { acmeApp } from './app';

/** Framework-owned acme world: broker + server + `clientCount` clients. */
export const acmeSystem: SyncSystemDef = defineSyncSystem(acmeApp, {
  id: 'sync.acme',
});

/** Same topology, but hydrating the large-catalog session query. */
export const acmeLargeCatalogSystem: SyncSystemDef = defineSyncSystem(acmeApp, {
  id: 'sync.acme.large-catalog',
  sessionQuery: { name: 'notesLargeWorld', params: {} },
});

export async function openAcmeWorld(
  opts: OpenWorldOptions<SyncKnobDefs>
): Promise<SyncSystemWorld> {
  return openWorld(acmeSystem, opts);
}

export async function openAcmeLargeCatalogWorld(
  opts: OpenWorldOptions<SyncKnobDefs>
): Promise<SyncSystemWorld> {
  return openWorld(acmeLargeCatalogSystem, opts);
}
