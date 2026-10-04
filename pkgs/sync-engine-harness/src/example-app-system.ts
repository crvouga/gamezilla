import { defineRuntime } from '@pkgs/harness-root-shared/define-runtime';
import { defineSystem } from '@pkgs/harness-root-shared/define-system';
import { gen } from '@pkgs/harness-root-shared/fast-check';
import type { SyncArgs } from './args';
import { arbSyncArgs } from './args';
import { exampleApp } from './example-app-app';
import { DST_FAULTS } from './faults';
import { toKernelFaults } from './network';
import { createSyncHarness, syncVirtual } from './scenario-boot';
import type { SyncHarness } from './scenario-system';
import { SYNC_POOL_ACTIONS } from './sync-actions';
import { SYNC_PROPERTY_DEFS } from './sync-properties';

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
export const exampleSystem = defineSystem<SyncHarness, SyncArgs>({
  name: 'sync.example',
  args: EXAMPLE_DEFAULT_ARGS,
  sample: () => gen(arbSyncArgs()),
  create: (session, args) => createSyncHarness(session, exampleApp, args),
  properties: [...SYNC_PROPERTY_DEFS],
  actions: SYNC_POOL_ACTIONS,
  runtimes: [
    defineRuntime({
      default: true,
      name: 'virtual',
      create: () => syncVirtual(),
    }),
    defineRuntime({
      name: EXAMPLE_DST_FAULTS_HOST,
      create: () => syncVirtual(toKernelFaults(DST_FAULTS)),
    }),
  ],
});

/** Hydrates the ~2k row catalog query instead of the pack default. */
export const EXAMPLE_LARGE_CATALOG_ARGS: Partial<SyncArgs> = {
  sessionQuery: { name: 'notesLargeAll', params: {} },
};
