import type { System } from '@pkgs/dst';

import {
  defineSyncSystem,
  type SyncSurface,
  type SyncSystemDef,
  syncKnobs,
} from '../../../sim/scenario';
import { acmeApp } from './app';

/** Framework-owned acme system: broker + server + `clientCount` clients. */
export const acmeSystem: SyncSystemDef = defineSyncSystem(acmeApp, {
  id: 'sync.acme',
});

/** Same topology, but hydrating the large-catalog session query. */
export const acmeLargeCatalogSystem: SyncSystemDef = defineSyncSystem(acmeApp, {
  id: 'sync.acme.large-catalog',
  sessionQuery: { name: 'notesLargeAll', params: {} },
});

/**
 * Typed system knobs for `start` — `acmeKnobs({ clientCount: 0 })`.
 *
 * Scripted pin shape:
 *
 * ```ts
 * await using run = await start(acmeSystem, {
 *   seed,
 *   host: syncVirtualHost(),
 *   knobs: acmeKnobs({ clientCount: 0, rowImageFanout: false }),
 *   properties: [],
 * });
 * await run.apply(addClient, 'alice');
 * await run.apply(mutate, 'alice', setNote, { id: 'n1', body: 'hi' });
 * await run.apply(passTime, 500);
 * expect(await run.observe(liveNote('server', 'n1'))).toEqual({
 *   body: 'hi',
 *   title: 'hi',
 *   deletedAt: null,
 * });
 * await expectConverged(run);
 * ```
 *
 * Poll instead of guessing a timeout with `untilAcme` (`./until`).
 */
export const acmeKnobs = syncKnobs;

export type { SyncSurface, SyncSystemDef, System };
