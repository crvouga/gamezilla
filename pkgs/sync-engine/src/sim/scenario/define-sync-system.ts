import {
  type Action,
  defineSystem,
  draw,
  type Property,
  type Session,
  type System,
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
import type { SyncKit } from '../kit-api';
import { bootSimInfra, bootSimServer } from '../kit-boot';
import { buildKitFacade } from '../kit-facade';
import type { KitClientOpts } from '../kit-types';
import { toKernelFaults, wrapSimNetwork } from '../network';
import { type UntilTarget, waitNever, waitUntil } from '../wait-until';
import { type ActionShadow, createActionShadow } from './action-shadow';
import type { SyncApp } from './app';
import { DEFAULT_SYNC_KNOBS, type SyncKnobs, syncSystemDraws } from './knobs';
import { createReplayRestartState, resetReplayRestartState } from './play';
import { createSyncActions } from './sync-actions';
import { SYNC_PROPERTIES } from './sync-properties';
import type { SyncRuntime, SyncSurface } from './system';

const SIM_START_MS = 1_700_000_000_000;
/** Post-topology settle window so clients finish initial hydration. */
const PREPARE_HYDRATION_MS = 200;

const RELIABLE_KERNEL_FAULTS: NetworkFaults = toKernelFaults(RELIABLE_FAULTS);

/** Teardown registered by `generate`, drained by the session's own dispose. */
const sessionTeardown = new WeakMap<Session, (() => Promise<void>)[]>();

/**
 * Run teardown before the session disposes, so `await using run` also closes
 * the sim kit (server, clients, broker).
 */
function onSessionDispose(session: Session, fn: () => Promise<void>): void {
  const hooks = sessionTeardown.get(session);
  if (hooks === undefined) {
    throw new Error(
      'defineSyncSystem: host must be syncVirtualHost() (no dispose hook)'
    );
  }
  hooks.push(fn);
}

export function syncVirtualHost(network?: NetworkFaults) {
  const base = virtualHost({
    startTime: SIM_START_MS,
    network: network ?? RELIABLE_KERNEL_FAULTS,
  });
  return {
    caps: base.caps,
    with: base.with.bind(base),
    async open(seed: number | bigint | string) {
      const base_ = await base.open(seed);
      const hooks: (() => Promise<void>)[] = [];
      const session: Session = {
        ...base_,
        // Sync clients schedule heartbeat / upload timers indefinitely. Algebra
        // `settle()` after each Act must not wait for global quiescence.
        settle: async () => {
          await base_.scheduler.underlying.runFor(0);
        },
        dispose: async () => {
          for (const fn of hooks.splice(0)) await fn();
          await base_.dispose();
        },
      };
      sessionTeardown.set(session, hooks);
      return session;
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
  const waitKit = {
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
    waitUntil: (target: UntilTarget, opts) => waitUntil(waitKit, target, opts),
    waitNever: (target, opts) => waitNever(waitKit, target, opts),
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
    async *generate(session) {
      const clientCount = yield* draw(gen(fc.integer({ min: 1, max: 3 })));
      const rowImageFanout = yield* draw(gen(fc.boolean()));
      const liveResendOnReconnect = yield* draw(gen(fc.boolean()));
      const bufferOutboundLive = yield* draw(gen(fc.boolean()));
      const knobs: SyncKnobs = {
        clientCount,
        rowImageFanout,
        liveResendOnReconnect,
        bufferOutboundLive,
      };

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
      onSessionDispose(session, () => runtime.kit.dispose());

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
export { DEFAULT_SYNC_KNOBS, SYNC_PROPERTIES, syncSystemDraws };
