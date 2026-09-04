import {
  asSeededRng,
  type Host,
  type NetworkFaults,
  type Ports,
  type Session,
  virtualHost,
} '@pkgs/dst';

import type { LocalDomainSchema } from '../../client/local-schema-migrate';
import type { MutationRegistry } from '../../mutations/core/types';
import type { QueryRegistry } from '../../queries/core/types';
import type { SyncBootDeps } from '../boot-deps';
import type { SimSessionQuery } from '../domain-pack';
import { RELIABLE_FAULTS } '../faults';
import type { SyncKit } from '../kit-api';
import { bootSimInfra, bootSimServer } '../kit-boot';
import { buildKitFacade } '../kit-facade';
import type { KitClientOpts } from '../kit-types';
import { toKernelFaults, wrapSimNetwork } '../network';
import { type ActionShadow, createActionShadow } './action-shadow';
import type { SyncApp } from './app';
import type { SyncArgs } from './args';
import { createReplayRestartState, resetReplayRestartState } './play';
import type { SyncRuntime, SyncSurface } from './system';

const SIM_START_MS = 1_700_000_000_000;
/** Post-topology settle window so clients finish initial hydration. */
const PREPARE_HYDRATION_MS = 200;

const RELIABLE_KERNEL_FAULTS: NetworkFaults = toKernelFaults(RELIABLE_FAULTS);

/**
 * Sync host: `virtualHost` with a settle that does not wait for heartbeat
 * quiescence. Register it with `system.host({ create: () => syncVirtual() })`.
 */
export function syncVirtual(network?: NetworkFaults): Host<Ports> {
  return virtualHost({
    startTime: SIM_START_MS,
    network: network ?? RELIABLE_KERNEL_FAULTS,
    // Sync clients schedule heartbeat / upload timers indefinitely.
    settle: async (session) => {
      await session.scheduler.underlying.runFor(0);
    },
  });
}

/**
 * Non-JSON per-system fixtures. Anything JSON-able belongs on {@link SyncArgs}
 * so it survives a Repro round-trip; schemas and registries close over the
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
): KitClientOpts {
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
 * Boot broker + server + `args.clientCount` clients and return the sync
 * surface. This is the `create` body of every sync `defineSystem`.
 */
export async function createSyncSurface(
  session: Session,
  app: SyncApp,
  args: SyncArgs,
  overrides: SyncBootOverrides = {}
): Promise<SyncSurface> {
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
    replay: createReplayRestartState(),
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

  for (let i = 0; i < args.clientCount; i += 1) {
    const id = `c${String(i)}`;
    await kit.addClient({ id, actorId: id });
  }

  const shadow = createActionShadow(app, [...kit.clients.keys()]);
  await session.elapse(PREPARE_HYDRATION_MS);
  return buildSurface(session, kit, runtime, shadow);
}
