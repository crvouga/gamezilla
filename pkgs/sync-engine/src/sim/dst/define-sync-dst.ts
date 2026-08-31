import {
  type DstKnobDef,
  type DstSystemDef,
  type DstWorld,
  defineDst,
  defineDstKnob,
  defineLibrary,
  type JsonValue,
  playActionsOnWorld,
} from '@pkgs/dst';
import fc from 'fast-check';

import type { SimSessionQuery } from '../domain-pack';
import { RELIABLE_FAULTS } from '../faults';
import { toKernelFaults } from '../network';
import type { DstAction } from './actions';
import { isLibraryAction } from './actions';
import type { DstApp } from './app';
import { libraryActionArbs } from './library-arbs';
import {
  SYNC_BROKER,
  SYNC_CLIENT,
  SYNC_SERVER,
  SYNC_WARMUP,
} from './node-kinds';
import {
  createReplayRestartState,
  prepareClientsForConverge,
  replayStep,
  resetClockSkews,
} from './play';
import { requireFacade, type SyncDstSystem } from './system';
import {
  applyActionToModel,
  CLIENT_IDS,
  initialWorldModel,
  modelAllowsAction,
  type WorldModel,
} from './world-model';

const WORLD_START_MS = 1_700_000_000_000;

export type SyncDstWorld = DstWorld<SyncDstSystem>;
export type SyncDstDef = DstSystemDef<SyncDstSystem>;

/** {@link WorldKnobs} as framework knob defs (id + default + arbitrary). */
export const SYNC_DST_KNOBS: readonly DstKnobDef[] = [
  defineDstKnob({ id: 'rowImageFanout', default: false, arb: fc.boolean() }),
  defineDstKnob({
    id: 'liveResendOnReconnect',
    default: false,
    arb: fc.boolean(),
  }),
  defineDstKnob({
    id: 'bufferOutboundLive',
    default: false,
    arb: fc.boolean(),
  }),
  defineDstKnob({
    id: 'clientCount',
    default: 2,
    arb: fc.integer({ min: 2, max: 3 }),
  }),
];

function asJsonArb<T>(arb: fc.Arbitrary<T>): fc.Arbitrary<JsonValue> {
  return arb as unknown as fc.Arbitrary<JsonValue>;
}

async function dispatchSync(
  world: SyncDstWorld,
  action: JsonValue
): Promise<void> {
  const system = world.system;
  await replayStep({
    world: requireFacade(system),
    app: system.app,
    action: action as unknown as DstAction,
    state: system.replay,
  });
}

async function syncPrepareConverge(world: SyncDstWorld): Promise<void> {
  const system = world.system;
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
 * Replay DST actions against an already-open sync world. Scripted pins that
 * also poke clients imperatively use this; pure scripts use `replayDst`.
 */
export async function playSyncActions(
  world: SyncDstWorld,
  actions: readonly DstAction[]
): Promise<void> {
  await playActionsOnWorld<JsonValue>({
    host: world,
    actions: actions as unknown as readonly JsonValue[],
    dispatch: (action) => dispatchSync(world, action),
    prepareConverge: () => syncPrepareConverge(world),
  });
}

function syncLibrary(app: DstApp) {
  return defineLibrary<SyncDstSystem>({
    kind: 'library',
    match: (action) => isLibraryAction(action as unknown as DstAction),
    arb: (ctx) =>
      fc.oneof(
        ...libraryActionArbs({
          clientIds: ctx.roleIds('client'),
          sessionQuery: app.pack.sessionQuery,
        }).map(asJsonArb)
      ),
    dispatch: dispatchSync,
  });
}

function syncDomainArbs(
  app: DstApp,
  clientIds: readonly string[]
): readonly fc.Arbitrary<JsonValue>[] {
  const domain = app
    .domainOpArbs({ clientIds })
    .map((arbitrary) => ({ arbitrary: asJsonArb(arbitrary), weight: 2 }));
  const server = (app.serverOpArbs?.({ clientIds }) ?? []).map((arbitrary) => ({
    arbitrary: asJsonArb(arbitrary),
    weight: 1,
  }));
  return [fc.oneof(...domain, ...server)];
}

function syncModel(app: DstApp) {
  return {
    initial: (): object => initialWorldModel(app, CLIENT_IDS),
    allows: (model: object, action: JsonValue): boolean =>
      modelAllowsAction(
        app,
        model as WorldModel,
        action as unknown as DstAction
      ),
    apply: (model: object, action: JsonValue): void => {
      applyActionToModel(
        app,
        model as WorldModel,
        action as unknown as DstAction
      );
    },
  };
}

export type DefineSyncDstOpts = {
  readonly id?: string;
  /** Override the domain pack session query (large-snapshot pins). */
  readonly sessionQuery?: SimSessionQuery;
};

/**
 * Framework-owned sync world: broker + server + N clients booted by
 * `@pkgs/dst` node kinds, with the full library/domain action pool.
 */
export function defineSyncDst(
  app: DstApp,
  opts?: DefineSyncDstOpts
): SyncDstDef {
  return defineDst<SyncDstSystem>({
    id: opts?.id ?? 'sync.world',
    startMs: WORLD_START_MS,
    network: { defaults: toKernelFaults(RELIABLE_FAULTS) },
    knobs: SYNC_DST_KNOBS,
    nodes: [
      { kind: SYNC_BROKER, role: 'broker', count: 1 },
      { kind: SYNC_SERVER, role: 'server', count: 1 },
      {
        kind: SYNC_CLIENT,
        role: 'client',
        countFromKnob: 'clientCount',
        idFor: (i) => `c${i}`,
      },
      { kind: SYNC_WARMUP, role: 'warmup', count: 1 },
    ],
    system: (): SyncDstSystem => ({
      app,
      ...(opts?.sessionQuery !== undefined
        ? { sessionQuery: opts.sessionQuery }
        : {}),
      replay: createReplayRestartState(),
      worldArgs: null,
      infra: null,
      kernel: null,
      facade: null,
    }),
    library: [syncLibrary(app)],
    domain: {
      arbs: (ctx) => syncDomainArbs(app, ctx.roleIds('client')),
      dispatch: dispatchSync,
    },
    model: syncModel(app),
    checkInvariants: (world) => requireFacade(world.system).checkInvariants(),
    prepareConverge: syncPrepareConverge,
    settle: async (world) => {
      await requireFacade(world.system).assertConverged();
    },
  });
}
