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

import type { InMemoryRoomStorage } from '../../server/adapters/memory';
import { toKernelFaults } from '../network';
import { type UntilPredicate, waitNever, waitUntil } from '../wait-until';
import type { World as KitWorld } from '../world-api';
import {
  type ActionShadow,
  applyActionToShadow,
  clientLive,
  createActionShadow,
  validClientIdsForLibrary,
} from './action-shadow';
import type { RoomSystemAction } from './actions';
import type { RoomApp } from './app';
import { dispatchRoomSystemAction } from './dispatch';
import { ROOM_SYSTEM_KNOBS, type RoomKnobDefs } from './knobs';
import {
  defaultClientIds,
  type LibraryArbEntry,
  SAMPLED_LIBRARY_ARBS,
  SCRIPTED_LIBRARY_ARBS,
} from './library-arbs';
import { createRoomNodes } from './node-kinds';
import { prepareClientsForConverge } from './play';
import { bindRoomRuntime, type RoomRuntime, requireKit } from './system';

const WORLD_START_MS = 1_700_000_000_000;

type RoomNodes = ReturnType<typeof createRoomNodes>;

export type RoomWorldExtension = {
  readonly kit: KitWorld;
  readonly runtime: RoomRuntime;
  readonly shadow: ActionShadow;
  readonly topic: KitWorld['topic'];
  readonly module: KitWorld['module'];
  readonly rng: KitWorld['rng'];
  readonly clock: KitWorld['clock'];
  readonly scheduler: KitWorld['scheduler'];
  readonly storage: KitWorld['storage'];
  readonly clients: KitWorld['clients'];
  readonly server: KitWorld['server'];
  readonly net: KitWorld['net'];
  readonly node: KitWorld['node'];
  readonly addClient: KitWorld['addClient'];
  readonly runFor: KitWorld['runFor'];
  readonly drain: KitWorld['drain'];
  readonly serverSnapshot: KitWorld['serverSnapshot'];
  readonly serverHash: KitWorld['serverHash'];
  readonly assertConverged: () => Promise<void>;
  readonly checkInvariants: () => Promise<void>;
  readonly armCrashAt: KitWorld['armCrashAt'];
  readonly clearBoundaryFaults: KitWorld['clearBoundaryFaults'];
  readonly serverCrash: KitWorld['serverCrash'];
  readonly serverRestart: KitWorld['serverRestart'];
  readonly isServerCrashed: KitWorld['isServerCrashed'];
  readonly waitUntil: (
    pred: UntilPredicate,
    opts?: { readonly withinMs?: number; readonly budgetMs?: number }
  ) => Promise<number>;
  readonly waitNever: (
    pred: UntilPredicate,
    opts: { readonly forMs: number }
  ) => Promise<void>;
};

export type RoomSurface = RoomWorldExtension;
export type RoomSystemWorld = World<RoomKnobDefs, RoomNodes, RoomSurface>;
export type RoomSystemDef = ScenarioDef<
  RoomKnobDefs,
  RoomNodes,
  RoomSurface,
  RoomSurface
>;

function asSystemArb(
  arb: fc.Arbitrary<RoomSystemAction>
): fc.Arbitrary<Action> {
  return arb as unknown as fc.Arbitrary<Action>;
}

function roomWaitWorld(kit: KitWorld) {
  return {
    seed: kit.seed,
    ports: { scheduler: kit.scheduler },
    advance: (ms: number) => kit.runFor(ms),
    now: () => kit.clock.now(),
    flushBeforePoll: () => kit.drain(),
    heldSummary: () => [] as readonly string[],
  };
}

async function dispatchRoom(surface: RoomSurface, act: Action): Promise<void> {
  const world = surface as unknown as RoomSystemWorld;
  await dispatchRoomSystemAction(
    world,
    surface.runtime.app,
    act as unknown as RoomSystemAction
  );
  applyActionToShadow(
    surface.runtime.app,
    surface.shadow,
    act as unknown as RoomSystemAction
  );
}

function kitExtension(
  kit: KitWorld,
  runtime: RoomRuntime,
  shadow: ActionShadow
): RoomWorldExtension {
  const wait = roomWaitWorld(kit);
  return {
    kit,
    runtime,
    shadow,
    topic: kit.topic,
    module: kit.module,
    rng: kit.rng,
    clock: kit.clock,
    scheduler: kit.scheduler,
    storage: kit.storage,
    clients: kit.clients,
    server: kit.server,
    net: kit.net,
    node: kit.node,
    addClient: kit.addClient,
    runFor: (ms) => kit.runFor(ms),
    drain: () => kit.drain(),
    serverSnapshot: () => kit.serverSnapshot(),
    serverHash: () => kit.serverHash(),
    assertConverged: () => kit.assertConverged(),
    checkInvariants: async () => {
      const inv = await kit.checkInvariants();
      if (inv !== null) {
        throw new Error(`${inv.invariant}: ${inv.detail}`);
      }
    },
    armCrashAt: kit.armCrashAt,
    clearBoundaryFaults: kit.clearBoundaryFaults,
    serverCrash: kit.serverCrash,
    serverRestart: kit.serverRestart,
    isServerCrashed: kit.isServerCrashed,
    waitUntil: (pred, opts) => waitUntil(wait, pred, opts),
    waitNever: (pred, opts) => waitNever(wait, pred, opts),
  };
}

/**
 * Replay DST actions against an already-open room world. Scripted pins that
 * also poke clients imperatively use this; pure scripts use `replay`.
 */
export async function playRoomActions(
  world: RoomSystemWorld,
  actionList: readonly RoomSystemAction[]
): Promise<void> {
  for (const action of actionList) {
    await dispatchRoom(world, action as unknown as Action);
    await world.runFor(STEP_MS);
  }
  await prepareClientsForConverge(world);
}

function libraryActionWeight(
  surface: RoomSurface,
  entry: LibraryArbEntry,
  sampledWeight: number
): number {
  if (sampledWeight === 0) return 0;
  if (entry.kind === 'heal') {
    return surface.shadow.held.size > 0 || surface.shadow.down.size > 0 ? 1 : 0;
  }
  return sampledWeight;
}

function libraryActionWeightForSurface(
  surface: RoomSurface,
  entry: LibraryArbEntry,
  sampledWeight: number
): number {
  const base = libraryActionWeight(surface, entry, sampledWeight);
  if (base === 0) return 0;
  switch (entry.kind) {
    case 'heal':
      return surface.shadow.held.size > 0 || surface.shadow.down.size > 0
        ? base
        : 0;
    case 'addSpectator':
      return surface.shadow.spectatorCount < 2 ? base : 0;
    case 'serverCrash':
      return surface.shadow.serverCrashed ? 0 : base;
    case 'serverRestart':
      return surface.shadow.serverCrashed ? base : 0;
    case 'idle':
      return base;
    default:
      return validClientIdsForLibrary(surface.shadow, entry.kind).length > 0
        ? base
        : 0;
  }
}

function libraryAction(
  entry: LibraryArbEntry,
  sampledWeight: number
): UnboundActionDef<unknown, RoomSurface> {
  return {
    weight: (surface) =>
      libraryActionWeightForSurface(surface, entry, sampledWeight),
    generate: (ctx) => {
      const surface = ctx.surface as RoomSurface;
      const valid = validClientIdsForLibrary(surface.shadow, entry.kind);
      const pick = fc.constantFrom(
        ...defaultClientIds(valid.length > 0 ? valid : ctx.nodeIds('client'))
      );
      return entry.arb(pick) as fc.Arbitrary<Action>;
    },
    apply: (surface, act) => dispatchRoom(surface, act as Action),
  };
}

function domainAction(app: RoomApp): UnboundActionDef<unknown, RoomSurface> {
  return {
    weight: (surface) => {
      for (const id of surface.shadow.clientIds) {
        if (clientLive(surface.shadow, id)) return 1;
      }
      return 0;
    },
    generate: (ctx) => {
      const surface = ctx.surface as RoomSurface;
      const live = surface.shadow.clientIds.filter((id) =>
        clientLive(surface.shadow, id)
      );
      return fc.oneof(
        ...app
          .domainOpArbs({ clientIds: defaultClientIds(live) })
          .map(asSystemArb)
      ) as fc.Arbitrary<Action>;
    },
    apply: (surface, act) => dispatchRoom(surface, act as Action),
  };
}

function roomActionCatalog(
  app: RoomApp
): Record<string, UnboundActionDef<unknown, RoomSurface>> {
  const out: Record<string, UnboundActionDef<unknown, RoomSurface>> = {
    domain: domainAction(app),
  };
  for (const entry of SAMPLED_LIBRARY_ARBS) {
    out[entry.kind] = libraryAction(entry, 1);
  }
  for (const entry of SCRIPTED_LIBRARY_ARBS) {
    out[entry.kind] = libraryAction(entry, 0);
  }
  return out;
}

export type DefineRoomSystemOpts = {
  readonly id?: string;
  readonly topic?: string;
  readonly storage?: InMemoryRoomStorage;
};

function initialRoomRuntime(
  app: RoomApp,
  opts?: DefineRoomSystemOpts
): RoomRuntime {
  return {
    app,
    kit: null,
    ...(opts?.topic !== undefined ? { topic: opts.topic } : {}),
    ...(opts?.storage !== undefined ? { storage: opts.storage } : {}),
  };
}

/** {@link RoomKnobDefs} as framework knob defs (default + arbitrary). */
export { ROOM_SYSTEM_KNOBS };

/**
 * Framework-owned room world: one server + `clientCount` clients booted by
 * `@pkgs/dst` node kinds, with per-kind library/domain actions.
 */
export function defineRoomSystem(
  app: RoomApp,
  opts?: DefineRoomSystemOpts
): RoomSystemDef {
  const runtimeOf = bindRoomRuntime(() => initialRoomRuntime(app, opts));
  const nodes = createRoomNodes(runtimeOf, app);
  const catalog = roomActionCatalog(app);

  return defineScenario({
    id: opts?.id ?? 'room.world',
    startTime: WORLD_START_MS,
    network: {
      faults: toKernelFaults({
        latencyMeanMs: 0,
        latencyJitterMs: 0,
        dropProbability: 0,
      }),
      edges: [{ fromRole: 'client', toRole: 'server' }],
    },
    knobs: ROOM_SYSTEM_KNOBS,
    nodes,
    actions: actions<RoomSurface>()(
      catalog
    ) as import('@pkgs/dst').ActionCatalog<RoomSurface>,
    properties: properties<RoomSurface>()({
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
    extend: async (world: RoomSystemWorld) => {
      const runtime = runtimeOf(world.ports);
      const kit = requireKit(runtime);
      const shadow = createActionShadow(app, world.nodeIds('client'));
      return kitExtension(kit, runtime, shadow);
    },
    converge: async (world: RoomSystemWorld) => {
      await prepareClientsForConverge(world);
      await world.assertConverged();
    },
  });
}
