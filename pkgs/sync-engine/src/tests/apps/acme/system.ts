import { defineSystem } from '@pkgs/dst';
import { gen } from '@pkgs/dst/fast-check';

import { DST_FAULTS } from '../../../sim/faults';
import { toKernelFaults } from '../../../sim/network';
import {
  arbSyncArgs,
  createSyncSurface,
  registerSyncLibrary,
  type SyncArgs,
  type SyncSurface,
  syncVirtual,
} from '../../../sim/scenario';
import { acmeApp } from './app';

/** Host name for the mild fixed reorder / loss profile ({@link DST_FAULTS}). */
export const ACME_DST_FAULTS_HOST = 'virtual-dst-faults';

/** System defaults; scripted tests overlay a partial. */
export const ACME_DEFAULT_ARGS: SyncArgs = {
  rowImageFanout: true,
  liveResendOnReconnect: false,
  bufferOutboundLive: false,
  clientCount: 2,
};

/**
 * Framework-owned acme system: broker + server + `args.clientCount` clients.
 *
 * Scripted pin shape:
 *
 * ```ts
 * await using s = await acmeSystem.script({
 *   seed,
 *   args: { clientCount: 0, rowImageFanout: false },
 * });
 * await s.apply(addClient, 'alice');
 * await s.apply(mutate, 'alice', setNote, { id: 'n1', body: 'hi' });
 * await s.elapse(500);
 * expect(await s.observe(liveNote, 'server', 'n1')).toEqual({
 *   body: 'hi',
 *   title: 'hi',
 *   deletedAt: null,
 * });
 * await expectConverged(s);
 * ```
 *
 * Poll with `s.until` / `untilAcme` (`./until`).
 */
export const acmeSystem = defineSystem<SyncSurface, SyncArgs>({
  name: 'sync.acme',
  args: ACME_DEFAULT_ARGS,
  draw: () => gen(arbSyncArgs()),
  create: (session, args) => createSyncSurface(session, acmeApp, args),
});

acmeSystem.host({
  default: true,
  name: 'virtual',
  create: () => syncVirtual(),
});
acmeSystem.host({
  name: ACME_DST_FAULTS_HOST,
  create: () => syncVirtual(toKernelFaults(DST_FAULTS)),
});
registerSyncLibrary(acmeSystem);

/** Hydrates the ~2k row catalog query instead of the pack default. */
export const ACME_LARGE_CATALOG_ARGS: Partial<SyncArgs> = {
  sessionQuery: { name: 'notesLargeAll', params: {} },
};

export type { SyncArgs, SyncSurface };
