import {
  type Action,
  defineSystem,
  draw,
  type Property,
  type Session,
  type System,
  start,
  virtualHost,
} from '@pkgs/dst';
import { gen } from '@pkgs/dst/fast-check';
import { asSeededRng, type NetworkFaults } from '@pkgs/dst/kernel';
import fc from 'fast-check';

import type { LocalDomainSchema } from '../../client/local-schema-migrate';
import type { MutationRegistry } from '../../mutations/core/types';
import type { QueryRegistry } from '../../queries/core/types';
import type { SyncBootDeps } from '../boot-deps';
import type { SimSessionQuery } from '../domain-pack';
import { RELIABLE_FAULTS } from '../faults';
import { toKernelFaults, wrapSimNetwork } from '../network';
import { type UntilTarget, waitNever, waitUntil } from '../wait-until';
import type { World as KitWorld } from '../world-api';
import { bootSimInfra, bootSimServer } from '../world-boot';
import { buildWorldFacade } from '../world-facade';
import type { WorldClientOpts } from '../world-types';
import {
  type ActionShadow,
  applyActionToShadow,
  createActionShadow,
} from './action-shadow';
import type { SyncAction } from './actions';
import type { SyncApp } from './app';
import { DEFAULT_WORLD_KNOBS, syncSystemDraws, type WorldKnobs } from './knobs';
import {
  createReplayRestartState,
  prepareClientsForConverge,
  replayStep,
  resetClockSkews,
  resetReplayRestartState,
} from './play';
import { createSyncActions } from './sync-actions';
import { SYNC_PROPERTIES } from './sync-properties';
import type { SyncRuntime, SyncSurface } from './system';

const WORLD_START_MS = 1_700_000_000_000;
/** Post-topology settle window so clients finish initial hydration. */
const PREPARE_HYDRATION_MS = 200;
/** Idle between scripted pin steps (legacy STEP_MS). */
export const SYNC_STEP_MS = 10;

const RELIABLE_KERNEL_FAULTS: NetworkFaults = toKernelFaults(RELIABLE_FAULTS);

export function syncVirtualHost(network?: NetworkFaults) {
  const base = virtualHost({
    startTime: WORLD_START_MS,
    network: network ?? RELIABLE_KERNEL_FAULTS,
  });
  // Sync clients schedule heartbeat / upload timers indefinitely. Algebra
  // `settle()` after each Act must not wait for global quiescence.
  return {
    caps: base.caps,
    with: base.with.bind(base),
    async open(seed: number | bigint | string) {
      const session = await base.open(seed);
      return {
        ...session,
        settle: async () => {
          await session.scheduler.underlying.runFor(0);
        },
      };
    },
  };
}

export type DefineSyncSystemOpts = {
  readonly id?: string;
  readonly sessionQuery?: SimSessionQuery;
  readonly localSchema?: LocalDomainSchema;
  readonly mutationRegistry?: MutationRegistry;
  readonly queryRegistry?: QueryRegistry;
};

export type SyncSystemDef = System<SyncSurface> & {
  readonly actions: readonly Action<SyncSurface>[];
  readonly properties: readonly Property<SyncSurface>[];
  readonly app: SyncApp;
  readonly opts?: DefineSyncSystemOpts;
};

function worldArgsFromDraws(
  runtime: Pick<
    SyncRuntime,
    | 'app'
    | 'sessionQuery'
    | 'localSchema'
    | 'mutationRegistry'
    | 'queryRegistry'
  >,
  knobs: WorldKnobs
): WorldClientOpts {
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
  kit: KitWorld,
  runtime: SyncRuntime,
  shadow: ActionShadow
): SyncSurface {
  const waitWorld = {
    seed: kit.seed,
    scheduler: kit.scheduler,
    network: { held: () => kit.network.heldSummary() },
  };
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
    checkInvariants: async () => {
      const inv = await kit.checkInvariants();
      if (inv !== null) {
        throw new Error(`${inv.invariant}: ${inv.detail}`);
      }
    },
    assertConverged: () => kit.assertConverged(),
    tamperLocalStorage: kit.tamperLocalStorage,
    armStoragePressure: kit.armStoragePressure,
    clearStoragePressure: kit.clearStoragePressure,
    armFailNextOpen: kit.armFailNextOpen,
    clearFailNextOpen: kit.clearFailNextOpen,
    brokerCrash: kit.brokerCrash,
    brokerRestart: kit.brokerRestart,
    clearBoundaryFaults: kit.clearBoundaryFaults,
    advance: (ms) => session.scheduler.advance(ms),
    waitUntil: (target: UntilTarget, opts) =>
      waitUntil(waitWorld, target, opts),
    waitNever: (target, opts) => waitNever(waitWorld, target, opts),
    dispose: () => kit.dispose(),
  };
}

async function syncPrepareConverge(surface: SyncSurface): Promise<void> {
  await prepareClientsForConverge(
    surface.runtime.app,
    surface,
    surface.runtime.replay
  );
  resetClockSkews(surface);
}

/**
 * Replay DST SyncAction objects against an already-open sync surface.
 */
export async function playSyncActions(
  world: SyncSurface,
  actionList: readonly SyncAction[]
): Promise<void> {
  for (const action of actionList) {
    await replayStep({
      world,
      app: world.runtime.app,
      action,
      state: world.runtime.replay,
    });
    applyActionToShadow(world.runtime.app, world.shadow, action);
    await world.checkInvariants();
    await world.advance(SYNC_STEP_MS);
  }
  await syncPrepareConverge(world);
}

export type OpenSyncOptions = {
  readonly seed: number | bigint | string;
  readonly knobs?: Partial<WorldKnobs>;
  readonly properties?: readonly Property<SyncSurface>[];
  readonly draws?: readonly unknown[];
  readonly networkFaults?: NetworkFaults;
};

/**
 * Open a sync system run and expose the domain surface for scripted pins.
 * Disposes kit + session on `await using`.
 */
export async function openSyncWorld(
  system: SyncSystemDef,
  opts: OpenSyncOptions
): Promise<SyncSurface & AsyncDisposable> {
  const run = await start(system, {
    seed: opts.seed,
    host: syncVirtualHost(opts.networkFaults),
    draws: opts.draws ?? syncSystemDraws(opts.knobs),
    // Scripted pins drive the surface imperatively; monitors are opt-in.
    properties: opts.properties ?? [],
  });
  const surface = run._internal.surface;
  return Object.assign(surface, {
    async [Symbol.asyncDispose]() {
      await surface.dispose();
      await run[Symbol.asyncDispose]();
    },
  });
}

/**
 * Framework-owned sync world: broker + server + N clients, full action pool.
 */
export function defineSyncSystem(
  app: SyncApp,
  opts?: DefineSyncSystemOpts
): SyncSystemDef {
  const sessionQuery = opts?.sessionQuery ?? app.pack.sessionQuery;
  const actions = createSyncActions(app, sessionQuery);
  const properties = [...SYNC_PROPERTIES];

  const system = defineSystem({
    name: opts?.id ?? 'sync.world',
    async *generate(session) {
      const clientCount = yield* draw(gen(fc.integer({ min: 1, max: 3 })));
      const rowImageFanout = yield* draw(gen(fc.boolean()));
      const liveResendOnReconnect = yield* draw(gen(fc.boolean()));
      const bufferOutboundLive = yield* draw(gen(fc.boolean()));
      const knobs: WorldKnobs = {
        clientCount,
        rowImageFanout,
        liveResendOnReconnect,
        bufferOutboundLive,
      };

      const replay = createReplayRestartState();
      const worldArgs = worldArgsFromDraws(
        {
          app,
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
        },
        knobs
      );

      const deps = bootDeps(session);
      const network = wrapSimNetwork(session.network, RELIABLE_FAULTS);
      const infra = bootSimInfra({
        worldArgs,
        injected: { deps, network },
      });
      const kernel = await bootSimServer({ infra, worldArgs });
      const kit = buildWorldFacade(kernel);
      const runtime: SyncRuntime = {
        app,
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
        replay,
        worldArgs,
        infra,
        kernel,
        kit,
      };
      resetReplayRestartState(runtime.replay);

      for (let i = 0; i < clientCount; i += 1) {
        const id = `c${i}`;
        await kit.addClient({ id, actorId: id });
      }

      const shadow = createActionShadow(app, [...kit.clients.keys()]);
      await session.scheduler.advance(PREPARE_HYDRATION_MS);
      return buildSurface(session, kit, runtime, shadow);
    },
  });

  return Object.assign(system, {
    actions,
    properties,
    app,
    ...(opts !== undefined ? { opts } : {}),
  });
}

export type { SyncRuntime, SyncSurface };
export { DEFAULT_WORLD_KNOBS, SYNC_PROPERTIES, syncSystemDraws };
