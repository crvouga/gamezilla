import {
  type Command,
  command,
  defineScenario,
  type ScenarioDef,
  type UnboundCommandDef,
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
import type { SyncAction } from './actions';
import type { SyncApp } from './app';
import { SYNC_SYSTEM_KNOBS, type SyncKnobDefs } from './knobs';
import {
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
import { requireKit, type SyncRuntime } from './system';
import {
  applyActionToModel,
  CLIENT_IDS,
  initialWorldModel,
  modelAllowsAction,
  type WorldModel,
} from './world-model';

const WORLD_START_MS = 1_700_000_000_000;
const COMMAND_STEP_MS = 10;
/** Post-topology settle window so clients finish initial hydration. */
const PREPARE_HYDRATION_MS = 200;

type SyncNodes = ReturnType<typeof createSyncNodes>;

type BaseSyncWorld = World<SyncKnobDefs, SyncNodes, Record<string, never>>;

export type SyncWorldExtension = {
  readonly kit: KitWorld;
  readonly runtime: SyncRuntime;
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

export type SyncSystemWorld = World<
  SyncKnobDefs,
  SyncNodes,
  SyncWorldExtension
>;
export type SyncSystemDef = ScenarioDef<
  SyncKnobDefs,
  SyncNodes,
  WorldModel,
  SyncWorldExtension
>;

type ModelHooks = Pick<
  UnboundCommandDef<Command, WorldModel, SyncSystemWorld>,
  'precondition' | 'applyToModel'
>;

function asSystemActionArb<T>(arb: fc.Arbitrary<T>): fc.Arbitrary<Command> {
  return arb as unknown as fc.Arbitrary<Command>;
}

async function dispatchSync(
  world: SyncSystemWorld,
  action: Command
): Promise<void> {
  await replayStep({
    world,
    app: world.runtime.app,
    action: action as unknown as SyncAction,
    state: world.runtime.replay,
  });
}

async function syncPrepareConverge(world: SyncSystemWorld): Promise<void> {
  const { replay } = world.runtime;
  await prepareClientsForConverge(world.runtime.app, world, replay);
  resetClockSkews(world);
}

function kitExtension(
  world: BaseSyncWorld,
  kit: KitWorld,
  runtime: SyncRuntime
): SyncWorldExtension {
  return {
    kit,
    runtime,
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
  actions: readonly SyncAction[]
): Promise<void> {
  for (const action of actions) {
    await dispatchSync(world, action as unknown as Command);
    await world.checkInvariants();
    await world.advance(COMMAND_STEP_MS);
  }
  await syncPrepareConverge(world);
}

function modelHooks(app: SyncApp): ModelHooks {
  return {
    precondition: (model, action) =>
      modelAllowsAction(app, model, action as unknown as SyncAction),
    applyToModel: (model, action) => {
      applyActionToModel(app, model, action as unknown as SyncAction);
    },
  };
}

function libraryAction(
  sessionQuery: SimSessionQuery,
  entry: LibraryArbEntry,
  hooks: ModelHooks
): UnboundCommandDef<Command, WorldModel, SyncSystemWorld> {
  return command({
    generate: (ctx) =>
      asSystemActionArb(
        libraryActionArb(entry, {
          clientIds: ctx.nodeIds('client'),
          sessionQuery,
        })
      ),
    apply: (world, act) => dispatchSync(world, act),
    ...hooks,
  });
}

function domainAction(
  app: SyncApp,
  hooks: ModelHooks
): UnboundCommandDef<Command, WorldModel, SyncSystemWorld> {
  return command({
    generate: (ctx) =>
      fc.oneof(
        ...app
          .domainOpArbs({ clientIds: ctx.nodeIds('client') })
          .map(asSystemActionArb)
      ),
    apply: (world, act) => dispatchSync(world, act),
    ...hooks,
  });
}

function serverAction(
  app: SyncApp,
  hooks: ModelHooks
): UnboundCommandDef<Command, WorldModel, SyncSystemWorld> | null {
  const serverOpArbs = app.serverOpArbs;
  if (serverOpArbs === undefined) return null;
  return command({
    generate: (ctx) =>
      fc.oneof(
        ...serverOpArbs({ clientIds: ctx.nodeIds('client') }).map(
          asSystemActionArb
        )
      ),
    apply: (world, act) => dispatchSync(world, act),
    ...hooks,
  });
}

function syncActions(
  app: SyncApp,
  sessionQuery: SimSessionQuery
): Record<string, UnboundCommandDef<Command, WorldModel, SyncSystemWorld>> {
  const hooks = modelHooks(app);
  const server = serverAction(app, hooks);
  const out: Record<
    string,
    UnboundCommandDef<Command, WorldModel, SyncSystemWorld>
  > = {};
  for (const entry of LIBRARY_ARB_ENTRIES) {
    out[entry.kind] = libraryAction(sessionQuery, entry, hooks);
  }
  out['domain'] = domainAction(app, hooks);
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
  const runtime = initialSyncRuntime(app, opts);
  const nodes = createSyncNodes(runtime);

  return defineScenario({
    id: opts?.id ?? 'sync.world',
    startTime: WORLD_START_MS,
    network: { faults: toKernelFaults(RELIABLE_FAULTS) },
    knobs: SYNC_SYSTEM_KNOBS,
    nodes,
    commands: syncActions(app, sessionQuery),
    referenceModel: {
      initial: (): WorldModel => initialWorldModel(app, CLIENT_IDS),
    },
    extend: async (world) => {
      resetReplayRestartState(runtime.replay);
      const kit = requireKit(runtime);
      await world.advance(PREPARE_HYDRATION_MS);
      return kitExtension(world as unknown as BaseSyncWorld, kit, runtime);
    },
    converge: async (world) => {
      await syncPrepareConverge(world);
      await world.assertConverged();
    },
    always: async (world) => {
      await world.checkInvariants();
    },
  });
}

export type SyncSystemFacade = SyncWorldExtension;
