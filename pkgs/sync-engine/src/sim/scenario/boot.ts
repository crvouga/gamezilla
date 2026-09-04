import {
  type Action,
  asSeededRng,
  type NetworkFaults,
  type Ports,
  type Runtime,
  type Session,
  type System,
  virtualTimeRuntime,
} from '@pkgs/sim';

import type { LocalDomainSchema } from '../../client/local-schema-migrate';
import type { MutationRegistry } from '../../mutations/core/types';
import type { QueryRegistry } from '../../queries/core/types';
import type { SyncBootDeps } from '../boot-deps';
import type { SimSessionQuery } from '../domain-pack';
import { RELIABLE_FAULTS } from '../faults';
import { toKernelFaults, wrapSimNetwork } from '../network';
import type { SyncSimRuntime } from '../sim-api';
import { bootSimInfra, bootSimServer } from '../sim-boot';
import { buildKitFacade } from '../sim-facade';
import type { SimClientOpts } from '../sim-types';
import type { SyncApp } from './app';
import type { SyncArgs } from './args';
import { SYNC_POOL_ACTIONS } from './sync-actions';
import { SYNC_PROPERTY_DEFS } from './sync-properties';
import { createOwedRestart, type SyncRuntime, type SyncSim } from './system';

export const SIM_START_MS = 1_700_000_000_000;
/** Post-topology settle window so clients finish initial hydration. */
const PREPARE_HYDRATION_MS = 200;

const RELIABLE_KERNEL_FAULTS: NetworkFaults = toKernelFaults(RELIABLE_FAULTS);

/**
 * Sync runtime: `virtualTimeRuntime` with a settle that does not wait for heartbeat
 * quiescence. Register it with `system.runtime({ create: () => syncVirtual() })`.
 */
export function syncVirtual(network?: NetworkFaults): Runtime<Ports> {
  return virtualTimeRuntime({
    startTime: SIM_START_MS,
    network: network ?? RELIABLE_KERNEL_FAULTS,
    // Sync clients schedule heartbeat / upload timers indefinitely.
    waitForIdle: async (session) => {
      await session.scheduler.underlying.runFor(0);
    },
  });
}

/** Every sync app system has the same surface and args shape. */
export type SyncSystemDef = System<SyncSim, SyncArgs>;

/** Register the shared explore pool + standing properties on `system`. */
export function registerSyncLibrary(system: SyncSystemDef): void {
  for (const action of SYNC_POOL_ACTIONS) {
    // Existential registration — the pool holds mixed action arities.
    system.action(action as unknown as Action<SyncSim>);
  }
  for (const def of SYNC_PROPERTY_DEFS) system.property(def);
}

/**
 * Non-JSON per-system fixtures. Anything JSON-able belongs on {@link SyncArgs}
 * so it survives a Recording round-trip; schemas and registries close over the
 * literal `defineSystem` instead.
 */
export type SyncBootOverrides = {
  readonly localSchema?: LocalDomainSchema;
  readonly mutationRegistry?: MutationRegistry;
  readonly queryRegistry?: QueryRegistry;
  readonly sessionQuery?: SimSessionQuery;
};

function clientOptsFor(
  app: SyncApp,
  args: SyncArgs,
  overrides: SyncBootOverrides
): SimClientOpts {
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
  kit: SyncSimRuntime,
  runtime: SyncRuntime
): SyncSim {
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
export async function createSyncSim(
  session: Session,
  app: SyncApp,
  args: SyncArgs,
  overrides: SyncBootOverrides = {}
): Promise<SyncSim> {
  const clientOpts = clientOptsFor(app, args, overrides);
  const deps = bootDeps(session);
  const network = wrapSimNetwork(session.network, RELIABLE_FAULTS);
  const infra = bootSimInfra({ clientOpts, injected: { deps, network } });
  const kernel = await bootSimServer({ infra, clientOpts });
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
