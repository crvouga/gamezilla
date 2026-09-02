import type { OpenWorldOpts } from '@pkgs/determinism';
import { openWorld } from '@pkgs/determinism';

import {
  defineSyncSystem,
  type SyncSystemDef,
  type SyncSystemWorld,
} from '../../../sim/system';
import type { SyncKnobDefs } from '../../../sim/system/knobs';
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
  opts: OpenWorldOpts<SyncKnobDefs>
): Promise<SyncSystemWorld> {
  return openWorld(acmeSystem, opts);
}

export async function openAcmeLargeCatalogWorld(
  opts: OpenWorldOpts<SyncKnobDefs>
): Promise<SyncSystemWorld> {
  return openWorld(acmeLargeCatalogSystem, opts);
}
