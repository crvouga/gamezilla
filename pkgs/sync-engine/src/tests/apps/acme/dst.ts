import { defineSyncDst, type SyncDstDef } from '../../../sim/dst';
import { acmeDstApp } from './dst-app';

/** Framework-owned acme world: broker + server + `clientCount` clients. */
export const acmeDst: SyncDstDef = defineSyncDst(acmeDstApp, {
  id: 'sync.acme',
});

/** Same topology, but hydrating the large-catalog session query. */
export const acmeLargeCatalogDst: SyncDstDef = defineSyncDst(acmeDstApp, {
  id: 'sync.acme.large-catalog',
  sessionQuery: { name: 'notesLargeWorld', params: {} },
});
