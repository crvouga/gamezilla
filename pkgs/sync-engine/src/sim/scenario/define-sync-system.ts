import {
  asSeededRng,
  type CatalogAction,
  type CatalogProperty,
  defineSystem,
  type NetworkFaults,
  type Session,
  type System,
  virtualHost,
} from '@pkgs/dst';

import type { LocalDomainSchema } from '../../client/local-schema-migrate';
import type { MutationRegistry } from '../../mutations/core/types';
import type { QueryRegistry } from '../../queries/core/types';
import type { SyncBootDeps } from '../boot-deps';
import type { SimSessionQuery } from '../domain-pack';
import { RELIABLE_FAULTS } from '../faults';
import type { SyncKit } from '../kit-api';
import { bootSimInfra, bootSimServer } from '../kit-boot';
import { buildKitFacade } from '../kit-facade';
import type { KitClientOpts } from '../kit-types';
import { toKernelFaults, wrapSimNetwork } from '../network';
import { type ActionShadow, createActionShadow } from './action-shadow';
import type { SyncApp } from './app';
import { DEFAULT_SYNC_KNOBS, type SyncKnobs, syncKnobs } from './knobs';
import { createReplayRestartState, resetReplayRestartState } from './play';
import { createSyncActions } from './sync-actions';
import { SYNC_PROPERTIES } from './sync-properties';
import type { SyncRuntime, SyncSurface } from './system';

const SIM_START_MS = 1_700_000_000_000;
/** Post-topology settle window so clients finish initial hydration. */
const PREPARE_HYDRATION_MS = 200;

const RELIABLE_KERNEL_FAULTS: NetworkFaults = toKernelFaults(RELIABLE_FAULTS);

/**
 * Sync host: virtualHost with settle that does not wait for heartbeat quiescence.
 */
export function syncVirtualHost(network?: NetworkFaults) {
  return virtualHost({
    startTime: SIM_START_MS,
    network: network ?? RELIABLE_KERNEL_FAULTS,
    // Sync clients schedule heartbeat / upload timers indefinitely.
    settle: async (session) => {
      await session.scheduler.underlying.runFor(0);
    },
  });
}

export type DefineSyncSystemOpts = {
  readonly id?: string;
  readonly sessionQuery?: SimSessionQuery;
  readonly localSchema?: LocalDomainSchema;
  readonly mutationRegistry?: MutationRegistry;
  readonly queryRegistry?: QueryRegistry;
};

export type SyncSystemDef = System<SyncSurface, SyncKnobs> & {
  readonly app: SyncApp;
  readonly opts?: DefineSyncSystemOpts;
  /** Explore / replay catalog — pass explicitly; not hung for walk. */
  readonly actions: readonly CatalogAction<SyncSurface>[];
  readonly properties: readonly CatalogProperty<SyncSurface>[];
};

type RuntimeOverrides = Pick<
  SyncRuntime,
  'sessionQuery' | 'localSchema' | 'mutationRegistry' | 'queryRegistry'
>;

/** Per-system registry / schema overrides, shared by system args and runtime. */
function runtimeOverrides(opts?: DefineSyncSystemOpts): RuntimeOverrides {
  return {
    ...(opts?.sessionQuery !== undefined
      ? { sessionQuery: opts.sessionQuery }
      : {}),
    ...(opts?.localSchema !== undefined
      ? { localSchema: opts.localSchema }
      : {}),
    ...(opts?.mutationRegistry !== undefined
      ? { mutationRegistry: opts.mutationRegistry }
      : {}),
    ...(opts?.queryRegistry !== undefined
      ? { queryRegistry: opts.queryRegistry }
      : {}),
  };
}

function kitArgsFromDraws(
  runtime: RuntimeOverrides & Pick<SyncRuntime, 'app'>,
  knobs: SyncKnobs
): KitClientOpts {
  return {
    domain: runtime.app.pack,
    rowImageFanout: knobs.rowImageFanout,
    liveResendOnReconnect: knobs.liveResendOnReconnect,
    bufferOutboundLive: knobs.bufferOutboundLive,
    ...(runtime.sessionQuery !== undefined
      ? { sessionQuery: runtime.sessionQuery }
      : {}),
    ...(runtime.localSchema !== undefined
      ? { localSchema: runtime.localSchema }
      : {}),
    ...(runtime.mutationRegistry !== undefined
      ? { mutationRegistry: runtime.mutationRegistry }
      : {}),
    ...(runtime.queryRegistry !== undefined
      ? { queryRegistry: runtime.queryRegistry }
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
  kit: SyncKit,
  runtime: SyncRuntime,
  shadow: ActionShadow
): SyncSurface {
  return {
    session,
    runtime,
    shadow,
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
    revive: () => kit.revive(),
    tamperLocalStorage: kit.tamperLocalStorage,
    armStoragePressure: kit.armStoragePressure,
    clearStoragePressure: kit.clearStoragePressure,
    armFailNextOpen: kit.armFailNextOpen,
    clearFailNextOpen: kit.clearFailNextOpen,
    brokerCrash: kit.brokerCrash,
    brokerRestart: kit.brokerRestart,
    clearBoundaryFaults: kit.clearBoundaryFaults,
    advance: (ms) => session.elapse(ms),
    dispose: () => kit.dispose(),
  };
}

/**
 * Framework-owned sync system: broker + server + N clients, full action pool.
 */
export function defineSyncSystem(
  app: SyncApp,
  opts?: DefineSyncSystemOpts
): SyncSystemDef {
  const sessionQuery = opts?.sessionQuery ?? app.pack.sessionQuery;
  const actions = createSyncActions(app, sessionQuery);
  const properties = [...SYNC_PROPERTIES];
  const overrides = runtimeOverrides(opts);

  const system = defineSystem({
    name: opts?.id ?? 'sync.system',
    async generate(session, knobs: SyncKnobs) {
      const replay = createReplayRestartState();
      const clientOpts = kitArgsFromDraws({ app, ...overrides }, knobs);

      const deps = bootDeps(session);
      const network = wrapSimNetwork(session.network, RELIABLE_FAULTS);
      const infra = bootSimInfra({
        clientOpts,
        injected: { deps, network },
      });
      const kernel = await bootSimServer({ infra, clientOpts });
      const kit = buildKitFacade(kernel);
      const runtime: SyncRuntime = {
        app,
        ...overrides,
        replay,
        lastMutation: new Map(),
        subscriptions: new Map(),
        lastPost: new Map(),
        clientOpts,
        infra,
        kernel,
        kit,
      };
      resetReplayRestartState(runtime.replay);
      session.onDispose(() => runtime.kit.dispose());

      for (let i = 0; i < knobs.clientCount; i += 1) {
        const id = `c${i}`;
        await kit.addClient({ id, actorId: id });
      }

      const shadow = createActionShadow(app, [...kit.clients.keys()]);
      await session.elapse(PREPARE_HYDRATION_MS);
      return buildSurface(session, kit, runtime, shadow);
    },
  });

  // Catalogs stay on the def for call-site convenience; explore still requires
  // explicit `actions` / `properties` options (not read from System by dst).
  return Object.assign(system, {
    actions,
    properties,
    app,
    ...(opts !== undefined ? { opts } : {}),
  }) as unknown as SyncSystemDef;
}

export type { SyncRuntime, SyncSurface };
export { DEFAULT_SYNC_KNOBS, SYNC_PROPERTIES, syncKnobs };
