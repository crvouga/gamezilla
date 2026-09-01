import {
  type ActionDef,
  defineAction,
  defineKnob,
  defineSystem,
  type KnobDef,
  type SystemAction,
  type SystemDef,
  type World,
} from '@pkgs/determinism';
import fc from 'fast-check';

import type { LocalDomainSchema } from '../../client/local-schema-migrate';
import type { MutationRegistry } from '../../mutations/core/types';
import type { QueryRegistry } from '../../queries/core/types';
import type { SimSessionQuery } from '../domain-pack';
import { RELIABLE_FAULTS } from '../faults';
import { toKernelFaults } from '../network';
import type { SyncAction } from './actions';
import type { SyncApp } from './app';
import {
  LIBRARY_ARB_ENTRIES,
  type LibraryArbEntry,
  libraryActionArb,
} from './library-arbs';
import { SYNC_BROKER, SYNC_CLIENT, SYNC_SERVER } from './node-kinds';
import {
  createReplayRestartState,
  prepareClientsForConverge,
  replayStep,
  resetClockSkews,
} from './play';
import { requireFacade, type SyncSystem } from './system';
import {
  applyActionToModel,
  CLIENT_IDS,
  initialWorldModel,
  modelAllowsAction,
  type WorldModel,
} from './world-model';

const WORLD_START_MS = 1_700_000_000_000;
const PLAY_STEP_MS = 10;
/** Post-topology settle window so clients finish initial hydration. */
const PREPARE_HYDRATION_MS = 200;

export type SyncSystemWorld = World<SyncSystem>;
export type SyncSystemDef = SystemDef<SyncSystem, WorldModel>;

type SyncActionDef = ActionDef<SyncSystem, SystemAction, WorldModel>;

/** {@link WorldKnobs} as framework knob defs (id + default + arbitrary). */
export const SYNC_SYSTEM_KNOBS: readonly KnobDef[] = [
  defineKnob({ id: 'rowImageFanout', default: true, arb: fc.boolean() }),
  defineKnob({
    id: 'liveResendOnReconnect',
    default: false,
    arb: fc.boolean(),
  }),
  defineKnob({
    id: 'bufferOutboundLive',
    default: false,
    arb: fc.boolean(),
  }),
  defineKnob({
    id: 'clientCount',
    default: 2,
    arb: fc.integer({ min: 2, max: 3 }),
  }),
];

function asSystemActionArb<T>(
  arb: fc.Arbitrary<T>
): fc.Arbitrary<SystemAction> {
  return arb as unknown as fc.Arbitrary<SystemAction>;
}

async function dispatchSync(
  world: SyncSystemWorld,
  action: SystemAction
): Promise<void> {
  const system = world.state;
  await replayStep({
    world: requireFacade(system),
    app: system.app,
    action: action as unknown as SyncAction,
    state: system.replay,
  });
}

async function syncPrepareConverge(world: SyncSystemWorld): Promise<void> {
  const system = world.state;
  const facade = requireFacade(system);
  await prepareClientsForConverge(
    system.app,
    facade,
    system.replay.needsRestart,
    system.replay.needsFreshRestart
  );
  resetClockSkews(facade);
}

/**
 * Replay DST actions against an already-open sync world (dispatch, invariant
 * check, small step advance, then converge prep). Scripted pins that also
 * poke clients imperatively use this; pure scripts use `replaySync`.
 */
export async function playSyncActions(
  world: SyncSystemWorld,
  actions: readonly SyncAction[]
): Promise<void> {
  const facade = requireFacade(world.state);
  for (const action of actions) {
    await dispatchSync(world, action as unknown as SystemAction);
    const inv = await facade.checkInvariants();
    if (inv !== null) {
      throw new Error(
        `${inv.invariant} seed=${world.seed.toString(16)}: ${inv.detail}`
      );
    }
    await facade.runFor(PLAY_STEP_MS);
  }
  await syncPrepareConverge(world);
}

type ModelHooks = Pick<SyncActionDef, 'allows' | 'apply'>;

function modelHooks(app: SyncApp): ModelHooks {
  return {
    allows: (model, action) =>
      modelAllowsAction(app, model, action as unknown as SyncAction),
    apply: (model, action) => {
      applyActionToModel(app, model, action as unknown as SyncAction);
    },
  };
}

function libraryAction(
  sessionQuery: SimSessionQuery,
  entry: LibraryArbEntry,
  hooks: ModelHooks
): SyncActionDef {
  return defineAction<SyncSystem, SystemAction, WorldModel>({
    kind: entry.kind,
    class: 'library',
    arb: (ctx) =>
      asSystemActionArb(
        libraryActionArb(entry, {
          clientIds: ctx.roleIds('client'),
          sessionQuery,
        })
      ),
    dispatch: dispatchSync,
    ...hooks,
  });
}

function domainAction(app: SyncApp, hooks: ModelHooks): SyncActionDef {
  return defineAction<SyncSystem, SystemAction, WorldModel>({
    kind: 'domain',
    class: 'domain',
    arb: (ctx) =>
      fc.oneof(
        ...app
          .domainOpArbs({ clientIds: ctx.roleIds('client') })
          .map(asSystemActionArb)
      ),
    dispatch: dispatchSync,
    ...hooks,
  });
}

function serverAction(app: SyncApp, hooks: ModelHooks): SyncActionDef | null {
  const serverOpArbs = app.serverOpArbs;
  if (serverOpArbs === undefined) return null;
  return defineAction<SyncSystem, SystemAction, WorldModel>({
    kind: 'server',
    class: 'domain',
    arb: (ctx) =>
      fc.oneof(
        ...serverOpArbs({ clientIds: ctx.roleIds('client') }).map(
          asSystemActionArb
        )
      ),
    dispatch: dispatchSync,
    ...hooks,
  });
}

function syncActions(
  app: SyncApp,
  sessionQuery: SimSessionQuery
): readonly SyncActionDef[] {
  const hooks = modelHooks(app);
  const server = serverAction(app, hooks);
  return [
    ...LIBRARY_ARB_ENTRIES.map((entry) =>
      libraryAction(sessionQuery, entry, hooks)
    ),
    domainAction(app, hooks),
    ...(server !== null ? [server] : []),
  ];
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

function initialSyncSystem(
  app: SyncApp,
  opts?: DefineSyncSystemOpts
): SyncSystem {
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
    facade: null,
  };
}

/**
 * Framework-owned sync world: broker + server + N clients booted by
 * `@pkgs/determinism` node kinds, with the full library/domain action pool.
 */
export function defineSyncSystem(
  app: SyncApp,
  opts?: DefineSyncSystemOpts
): SyncSystemDef {
  const sessionQuery = opts?.sessionQuery ?? app.pack.sessionQuery;
  return defineSystem<SyncSystem, WorldModel>({
    id: opts?.id ?? 'sync.world',
    startMs: WORLD_START_MS,
    network: { defaults: toKernelFaults(RELIABLE_FAULTS) },
    knobs: SYNC_SYSTEM_KNOBS,
    nodes: [
      { kind: SYNC_BROKER, role: 'broker', count: 1 },
      { kind: SYNC_SERVER, role: 'server', count: 1 },
      {
        kind: SYNC_CLIENT,
        role: 'client',
        countFromKnob: 'clientCount',
        idFor: (i) => `c${i}`,
      },
    ],
    state: () => initialSyncSystem(app, opts),
    actions: syncActions(app, sessionQuery),
    model: {
      initial: (): WorldModel => initialWorldModel(app, CLIENT_IDS),
    },
    prepare: async (world) => {
      await requireFacade(world.state).runFor(PREPARE_HYDRATION_MS);
    },
    settle: async (world) => {
      await syncPrepareConverge(world);
      await requireFacade(world.state).assertConverged();
    },
    invariants: (world) => requireFacade(world.state).checkInvariants(),
  });
}
