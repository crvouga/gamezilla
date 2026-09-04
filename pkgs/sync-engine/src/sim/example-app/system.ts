import { defineSystem } from '@pkgs/sim';
import { gen } from '@pkgs/sim/fast-check';

import { DST_FAULTS } from '../faults';
import { toKernelFaults } from '../network';
import {
  arbSyncArgs,
  createSyncSim,
  registerSyncLibrary,
  type SyncArgs,
  type SyncSim,
  syncVirtual,
} from '../scenario';
import { exampleApp } from './app';

/** Runtime name for the mild fixed reorder / loss profile ({@link DST_FAULTS}). */
export const EXAMPLE_DST_FAULTS_HOST = 'virtual-dst-faults';

/** System defaults; scripted tests overlay a partial. */
export const EXAMPLE_DEFAULT_ARGS: SyncArgs = {
  rowImageFanout: true,
  liveResendOnReconnect: false,
  bufferOutboundLive: false,
  clientCount: 2,
};

/**
 * Framework-owned example system: broker + server + `args.clientCount` clients.
 *
 * Scripted pin shape:
 *
 * ```ts
 * await using s = await exampleSystem.run({
 *   seed,
 *   args: { clientCount: 0, rowImageFanout: false },
 * });
 * await s.apply(addClient, 'alice');
 * await s.apply(mutate, 'alice', setNote, { id: 'n1', body: 'hi' });
 * await s.advanceTime(500);
 * expect(await s.read(liveNote, 'server', 'n1')).toEqual({
 *   body: 'hi',
 *   title: 'hi',
 *   deletedAt: null,
 * });
 * await expectInSync(s);
 * ```
 *
 * Poll with `s.until` / `untilExample` (`./until`).
 */
export const exampleSystem = defineSystem<SyncSim, SyncArgs>({
  name: 'sync.example',
  args: EXAMPLE_DEFAULT_ARGS,
  sample: () => gen(arbSyncArgs()),
  create: (session, args) => createSyncSim(session, exampleApp, args),
});

exampleSystem.runtime({
  default: true,
  name: 'virtual',
  create: () => syncVirtual(),
});
exampleSystem.runtime({
  name: EXAMPLE_DST_FAULTS_HOST,
  create: () => syncVirtual(toKernelFaults(DST_FAULTS)),
});
registerSyncLibrary(exampleSystem);

/** Hydrates the ~2k row catalog query instead of the pack default. */
export const EXAMPLE_LARGE_CATALOG_ARGS: Partial<SyncArgs> = {
  sessionQuery: { name: 'notesLargeAll', params: {} },
};

export type { SyncArgs, SyncSim };
