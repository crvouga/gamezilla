import { defineSyncSystem, type SyncSystemDef } from '../../../sim/system';
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
