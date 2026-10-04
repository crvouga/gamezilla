import type { System } from '@pkgs/harness-shared/define-system';
import type { NetworkFaults } from '@pkgs/harness-shared/network-state';
import { asSeededRng } from '@pkgs/harness-shared/rng';
import type {
  Ports,
  Runtime,
  Session,
} from '@pkgs/harness-shared/runtime-types';
import { virtualTimeRuntime } from '@pkgs/harness-shared/virtual-time-runtime';

import type { LocalDomainSchema } from '@pkgs/sync-engine-client/local-schema-migrate';
import type { MutationRegistry } from '@pkgs/sync-engine-shared/mutations-types';
import type { QueryRegistry } from '@pkgs/sync-engine-shared/queries-types';
import type { SyncHarnessRuntime } from './api';
import type { SyncArgs } from './args';
import type { SyncBootDeps } from './boot-deps';
import { buildKitFacade } from './facade';
import { RELIABLE_FAULTS } from './faults';
import { bootHarnessInfra, bootHarnessServer } from './harness-boot';
import type { HarnessSessionQuery } from './harness-domain-pack';
import { toKernelFaults, wrapHarnessNetwork } from './network';
import type { SyncApp } from './scenario-app';
import type { SyncHarness, SyncRuntime } from './scenario-system';
import { createOwedRestart } from './scenario-system';
import type { HarnessClientOpts } from './types';

export const HARNESS_START_MS = 1_700_000_000_000;
/** Post-topology settle window so clients finish initial hydration. */
const PREPARE_HYDRATION_MS = 200;

const RELIABLE_KERNEL_FAULTS: NetworkFaults = toKernelFaults(RELIABLE_FAULTS);

/**
 * Sync runtime: `virtualTimeRuntime` with a settle that does not wait for heartbeat
 * quiescence. Pass `create: () => syncVirtual()` into `defineRuntime`.
 */
export function syncVirtual(network?: NetworkFaults): Runtime<Ports> {
  return virtualTimeRuntime({
    startTime: HARNESS_START_MS,
    network: network ?? RELIABLE_KERNEL_FAULTS,
    // Sync clients schedule heartbeat / upload timers indefinitely.
    waitForIdle: async (session) => {
      await session.scheduler.underlying.runFor(0);
    },
  });
}

/** Every sync app system has the same surface and args shape. */
export type SyncSystemDef = System<SyncHarness, SyncArgs>;

/**
 * Non-JSON per-system fixtures. Anything JSON-able belongs on {@link SyncArgs}
 * so it survives a Recording round-trip; schemas and registries close over the
 * literal `defineSystem` instead.
 */
export type SyncBootOverrides = {
  readonly localSchema?: LocalDomainSchema;
  readonly mutationRegistry?: MutationRegistry;
  readonly queryRegistry?: QueryRegistry;
  readonly sessionQuery?: HarnessSessionQuery;
};

function clientOptsFor(
  app: SyncApp,
  args: SyncArgs,
  overrides: SyncBootOverrides
): HarnessClientOpts {
  const sessionQuery = args.sessionQuery ?? overrides.sessionQuery;
  return {
    domain: app.pack,
    rowImageFanout: args.rowImageFanout,
    liveResendOnReconnect: args.liveResendOnReconnect,
    bufferOutboundLive: args.bufferOutboundLive,
    ...(sessionQuery !== undefined ? { sessionQuery } : {}),
    ...(overrides.localSchema !== undefined
      ? { localSchema: overrides.localSchema }
      : {}),
    ...(overrides.mutationRegistry !== undefined
      ? { mutationRegistry: overrides.mutationRegistry }
      : {}),
    ...(overrides.queryRegistry !== undefined
      ? { queryRegistry: overrides.queryRegistry }
      : {}),
  };
}

function bootDeps(session: Session): SyncBootDeps {
  return {
    clock: session.ports.clock,
    scheduler: session.scheduler.underlying,
    timers: session.ports.timers,
    rng: asSeededRng(session.ports.rng),
  };
}

function buildSurface(
  session: Session,
  kit: SyncHarnessRuntime,
  runtime: SyncRuntime
): SyncHarness {
  return {
    session,
    runtime,
    seed: kit.seed,
    rng: kit.rng,
    clients: kit.clients,
    server: kit.server,
    kit: { network: kit.network },
    net: kit.net,
    node: kit.node,
    addClient: kit.addClient,
    nodeIds: (role) => {
      if (role === 'server') return ['server'] as const;
      if (role === 'client') return [...kit.clients.keys()];
      return [];
    },
    isSchedulerQuiescent: kit.isSchedulerQuiescent,
    pendingEventCount: kit.pendingEventCount,
    recoverAll: () => kit.recoverAll(),
    tamperLocalStorage: kit.tamperLocalStorage,
    armStoragePressure: kit.armStoragePressure,
    clearStoragePressure: kit.clearStoragePressure,
    armFailNextOpen: kit.armFailNextOpen,
    clearFailNextOpen: kit.clearFailNextOpen,
    brokerCrash: kit.brokerCrash,
    brokerRestart: kit.brokerRestart,
    clearEdgeFaults: kit.clearEdgeFaults,
    advance: (ms) => session.advanceTime(ms),
    dispose: () => kit.dispose(),
  };
}

/**
 * Boot broker + server + `args.clientCount` clients and return the sync
 * surface. This is the `create` body of every sync `defineSystem`.
 */
export async function createSyncHarness(
  session: Session,
  app: SyncApp,
  args: SyncArgs,
  overrides: SyncBootOverrides = {}
): Promise<SyncHarness> {
  const clientOpts = clientOptsFor(app, args, overrides);
  const deps = bootDeps(session);
  const network = wrapHarnessNetwork(session.network, RELIABLE_FAULTS);
  const infra = bootHarnessInfra({ clientOpts, injected: { deps, network } });
  const kernel = await bootHarnessServer({ infra, clientOpts });
  const kit = buildKitFacade(kernel);

  const runtime: SyncRuntime = {
    app,
    ...(clientOpts.sessionQuery !== undefined
      ? { sessionQuery: clientOpts.sessionQuery }
      : {}),
    ...(overrides.localSchema !== undefined
      ? { localSchema: overrides.localSchema }
      : {}),
    ...(overrides.mutationRegistry !== undefined
      ? { mutationRegistry: overrides.mutationRegistry }
      : {}),
    ...(overrides.queryRegistry !== undefined
      ? { queryRegistry: overrides.queryRegistry }
      : {}),
    owed: createOwedRestart(),
    poolSubscriptions: new Set(),
    lastMutation: new Map(),
    subscriptions: new Map(),
    lastPost: new Map(),
    clientOpts,
    infra,
    kernel,
    kit,
  };
  session.onDispose(() => runtime.kit.dispose());

  for (let i = 0; i < args.clientCount; i += 1) {
    const id = `c${String(i)}`;
    await kit.addClient({ id, actorId: id });
  }

  await session.advanceTime(PREPARE_HYDRATION_MS);
  return buildSurface(session, kit, runtime);
}
