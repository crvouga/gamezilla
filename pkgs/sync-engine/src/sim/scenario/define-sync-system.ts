import {
  type Action,
  actions,
  defineScenario,
  properties,
  property,
  type ScenarioDef,
  STEP_MS,
  type UnboundActionDef,
  type World,
} from '@pkgs/dst';
import fc from 'fast-check';

import type { LocalDomainSchema } from '../../client/local-schema-migrate';
import type { MutationRegistry } from '../../mutations/core/types';
import type { QueryRegistry } from '../../queries/core/types';
import type { SimSessionQuery } from '../domain-pack';
import { RELIABLE_FAULTS } from '../faults';
import { toKernelFaults } from '../network';
import { type UntilTarget, waitNever, waitUntil } from '../wait-until';
import type { World as KitWorld } from '../world-api';
import {
  type ActionShadow,
  applyActionToShadow,
  clientLive,
  createActionShadow,
} from './action-shadow';
import type { SyncAction } from './actions';
import type { SyncApp } from './app';
import { SYNC_SYSTEM_KNOBS, type SyncKnobDefs } from './knobs';
import {
  defaultClientIds,
  LIBRARY_ARB_ENTRIES,
  type LibraryArbEntry,
  libraryActionArb,
} from './library-arbs';
import { createSyncNodes } from './node-kinds';
import {
  createReplayRestartState,
  prepareClientsForConverge,
  replayStep,
  resetClockSkews,
  resetReplayRestartState,
} from './play';
import { bindSyncRuntime, requireKit, type SyncRuntime } from './system';

const WORLD_START_MS = 1_700_000_000_000;
/** Post-topology settle window so clients finish initial hydration. */
const PREPARE_HYDRATION_MS = 200;

type SyncNodes = ReturnType<typeof createSyncNodes>;

type BaseSyncWorld = World<SyncKnobDefs, SyncNodes, Record<string, never>>;

export type SyncWorldExtension = {
  readonly kit: KitWorld;
  readonly runtime: SyncRuntime;
  readonly shadow: ActionShadow;
  readonly rng: KitWorld['rng'];
  readonly clients: KitWorld['clients'];
  readonly server: KitWorld['server'];
  readonly net: KitWorld['net'];
  readonly node: KitWorld['node'];
  readonly nextId: KitWorld['nextId'];
  readonly addClient: KitWorld['addClient'];
  readonly isSchedulerQuiescent: KitWorld['isSchedulerQuiescent'];
  readonly pendingEventCount: KitWorld['pendingEventCount'];
  readonly checkInvariants: () => Promise<void>;
  readonly assertConverged: () => Promise<void>;
  readonly tamperLocalStorage: KitWorld['tamperLocalStorage'];
  readonly armStoragePressure: KitWorld['armStoragePressure'];
  readonly clearStoragePressure: KitWorld['clearStoragePressure'];
  readonly armFailNextOpen: KitWorld['armFailNextOpen'];
  readonly clearFailNextOpen: KitWorld['clearFailNextOpen'];
  readonly brokerCrash: KitWorld['brokerCrash'];
  readonly brokerRestart: KitWorld['brokerRestart'];
  readonly clearBoundaryFaults: KitWorld['clearBoundaryFaults'];
  readonly waitUntil: (
    target: UntilTarget,
    opts?: {
      readonly withinMs?: number;
      readonly budgetMs?: number;
      readonly stepMs?: number;
    }
  ) => Promise<number>;
  readonly waitNever: (
    target: UntilTarget,
    opts: { readonly forMs: number }
  ) => Promise<void>;
};

export type SyncSurface = SyncWorldExtension;
export type SyncSystemWorld = World<SyncKnobDefs, SyncNodes, SyncSurface>;
export type SyncSystemDef = ScenarioDef<
  SyncKnobDefs,
  SyncNodes,
  SyncSurface,
  SyncSurface
>;

function asSystemActionArb<T>(arb: fc.Arbitrary<T>): fc.Arbitrary<Action> {
  return arb as unknown as fc.Arbitrary<Action>;
}

async function dispatchSync(world: SyncSurface, action: Action): Promise<void> {
  const full = world as unknown as SyncSystemWorld;
  await replayStep({
    world: full,
    app: world.runtime.app,
    action: action as unknown as SyncAction,
    state: world.runtime.replay,
  });
  applyActionToShadow(
    world.runtime.app,
    world.shadow,
    action as unknown as SyncAction
  );
}

async function syncPrepareConverge(world: SyncSystemWorld): Promise<void> {
  const { replay } = world.runtime;
  await prepareClientsForConverge(world.runtime.app, world, replay);
  resetClockSkews(world);
}

function kitExtension(
  world: BaseSyncWorld,
  kit: KitWorld,
  runtime: SyncRuntime,
  shadow: ActionShadow
): SyncWorldExtension {
  return {
    kit,
    runtime,
    shadow,
    rng: kit.rng,
    clients: kit.clients,
    server: kit.server,
    net: kit.net,
    node: kit.node,
    nextId: kit.nextId,
    addClient: kit.addClient,
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
    waitUntil: (target, opts) => waitUntil(world, target, opts),
    waitNever: (target, opts) => waitNever(world, target, opts),
  };
}

/**
 * Replay DST actions against an already-open sync world (dispatch, invariant
 * check, small step advance, then converge prep). Scripted pins that also
 * poke clients imperatively use this; pure scripts use `replay`.
 */
export async function playSyncActions(
  world: SyncSystemWorld,
  actionList: readonly SyncAction[]
): Promise<void> {
  for (const action of actionList) {
    await dispatchSync(world, action as unknown as Action);
    await world.checkInvariants();
    await world.advance(STEP_MS);
  }
  await syncPrepareConverge(world);
}

function libraryActionWeight(
  surface: SyncSurface,
  entry: LibraryArbEntry
): number {
  if (entry.kind === 'heal') {
    return surface.shadow.partitioned.size > 0 || surface.shadow.held.size > 0
      ? 1
      : 0;
  }
  return 1;
}

function libraryAction(
  sessionQuery: SimSessionQuery,
  entry: LibraryArbEntry
): UnboundActionDef<unknown, SyncSurface> {
  return {
    weight: (surface) => libraryActionWeight(surface, entry),
    generate: (ctx) => {
      const surface = ctx.surface as SyncSurface;
      const live = surface.shadow.clientIds.filter((id) =>
        clientLive(surface.shadow, id)
      );
      return libraryActionArb(entry, {
        clientIds: defaultClientIds(
          live.length > 0 ? live : ctx.nodeIds('client')
        ),
        sessionQuery,
      }) as fc.Arbitrary<Action>;
    },
    apply: (surface, act) => dispatchSync(surface, act as Action),
  };
}

function domainAction(app: SyncApp): UnboundActionDef<unknown, SyncSurface> {
  return {
    weight: (surface) => {
      for (const id of surface.shadow.clientIds) {
        if (clientLive(surface.shadow, id)) return 1;
      }
      return 0;
    },
    generate: (ctx) => {
      const surface = ctx.surface as SyncSurface;
      const live = surface.shadow.clientIds.filter((id) =>
        clientLive(surface.shadow, id)
      );
      return fc.oneof(
        ...app
          .domainOpArbs({
            clientIds: defaultClientIds(
              live.length > 0 ? live : ctx.nodeIds('client')
            ),
          })
          .map(asSystemActionArb)
      ) as fc.Arbitrary<Action>;
    },
    apply: (surface, act) => dispatchSync(surface, act as Action),
  };
}

function serverAction(
  app: SyncApp
): UnboundActionDef<unknown, SyncSurface> | null {
  const serverOpArbs = app.serverOpArbs;
  if (serverOpArbs === undefined) return null;
  return {
    weight: 1,
    generate: (ctx) =>
      fc.oneof(
        ...serverOpArbs({ clientIds: ctx.nodeIds('client') }).map(
          asSystemActionArb
        )
      ),
    apply: (surface, act) => dispatchSync(surface, act as Action),
  };
}

function syncActionCatalog(
  app: SyncApp,
  sessionQuery: SimSessionQuery
): Record<string, UnboundActionDef<unknown, SyncSurface>> {
  const out: Record<string, UnboundActionDef<unknown, SyncSurface>> = {};
  for (const entry of LIBRARY_ARB_ENTRIES) {
    out[entry.kind] = libraryAction(sessionQuery, entry);
  }
  out['domain'] = domainAction(app);
  const server = serverAction(app);
  if (server !== null) {
    out['server'] = server;
  }
  return out;
}

export type DefineSyncSystemOpts = {
  readonly id?: string;
  /** Override the domain pack session query (large-snapshot pins). */
  readonly sessionQuery?: SimSessionQuery;
  /** Server + default-client pack overrides (mixed-schema pins). */
  readonly localSchema?: LocalDomainSchema;
  readonly mutationRegistry?: MutationRegistry;
  readonly queryRegistry?: QueryRegistry;
};

function initialSyncRuntime(
  app: SyncApp,
  opts?: DefineSyncSystemOpts
): SyncRuntime {
  return {
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
    replay: createReplayRestartState(),
    worldArgs: null,
    infra: null,
    kernel: null,
    kit: null,
  };
}

/** {@link SyncKnobDefs} as framework knob defs (default + arbitrary). */
export { SYNC_SYSTEM_KNOBS };

/**
 * Framework-owned sync world: broker + server + N clients booted by
 * `@pkgs/dst` node kinds, with the full library/domain action pool.
 */
export function defineSyncSystem(
  app: SyncApp,
  opts?: DefineSyncSystemOpts
): SyncSystemDef {
  const sessionQuery = opts?.sessionQuery ?? app.pack.sessionQuery;
  const runtimeOf = bindSyncRuntime(() => initialSyncRuntime(app, opts));
  const nodes = createSyncNodes(runtimeOf);
  const catalog = syncActionCatalog(app, sessionQuery);

  return defineScenario({
    id: opts?.id ?? 'sync.world',
    startTime: WORLD_START_MS,
    network: { faults: toKernelFaults(RELIABLE_FAULTS) },
    knobs: SYNC_SYSTEM_KNOBS,
    nodes,
    actions: actions<SyncSurface>()(
      catalog
    ) as import('@pkgs/dst').ActionCatalog<SyncSurface>,
    properties: properties<SyncSurface>()({
      invariants: property.always(async (surface) => {
        await surface.checkInvariants();
        return true;
      }),
      converged: property.always(
        async (surface) => {
          await surface.assertConverged();
          return true;
        },
        { at: 'converge' }
      ),
    }),
    extend: async (world) => {
      const runtime = runtimeOf(world.ports);
      resetReplayRestartState(runtime.replay);
      const kit = requireKit(runtime);
      const shadow = createActionShadow(app, world.nodeIds('client'));
      await world.advance(PREPARE_HYDRATION_MS);
      return kitExtension(
        world as unknown as BaseSyncWorld,
        kit,
        runtime,
        shadow
      );
    },
    converge: async (world) => {
      await syncPrepareConverge(world);
      await world.assertConverged();
    },
  });
}

export type SyncSystemFacade = SyncWorldExtension;
