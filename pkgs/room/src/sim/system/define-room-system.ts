import {
  action,
  defineSystem,
  type SystemAction,
  type SystemDef,
  type UnboundActionDef,
  type World,
} from '@pkgs/determinism';
import fc from 'fast-check';

import type { InMemoryRoomStorage } from '../../server/adapters/memory';
import { toKernelFaults } from '../network';
import { type UntilPredicate, waitNever, waitUntil } from '../wait-until';
import type { World as KitWorld } from '../world-api';
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
import { type RoomRuntime, requireKit } from './system';
import {
  applyActionToModel,
  CLIENT_IDS,
  initialWorldModel,
  modelAllowsAction,
  type WorldModel,
} from './world-model';

const WORLD_START_MS = 1_700_000_000_000;
const PLAY_STEP_MS = 10;

type RoomNodes = ReturnType<typeof createRoomNodes>;

export type RoomWorldExtension = {
  readonly kit: KitWorld;
  readonly runtime: RoomRuntime;
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

export type RoomSystemWorld = World<
  RoomKnobDefs,
  RoomNodes,
  RoomWorldExtension
>;
export type RoomSystemDef = SystemDef<
  RoomKnobDefs,
  RoomNodes,
  WorldModel,
  RoomWorldExtension
>;

type ModelHooks = {
  allows: (model: WorldModel, action: SystemAction) => boolean;
  apply: (model: WorldModel, action: SystemAction) => void;
};

function asSystemArb(
  arb: fc.Arbitrary<RoomSystemAction>
): fc.Arbitrary<SystemAction> {
  return arb as unknown as fc.Arbitrary<SystemAction>;
}

function pickClient(ctx: { ids: (role: string) => readonly string[] }) {
  return fc.constantFrom(...defaultClientIds(ctx.ids('client')));
}

function roomWaitWorld(kit: KitWorld) {
  return {
    seed: kit.seed,
    deps: { scheduler: kit.scheduler },
    advance: (ms: number) => kit.runFor(ms),
    now: () => kit.clock.now(),
    flushBeforePoll: () => kit.drain(),
    heldSummary: () => [] as readonly string[],
  };
}

async function dispatchRoom(
  world: RoomSystemWorld,
  act: SystemAction
): Promise<void> {
  await dispatchRoomSystemAction(
    world,
    world.runtime.app,
    act as unknown as RoomSystemAction
  );
}

function kitExtension(kit: KitWorld, runtime: RoomRuntime): RoomWorldExtension {
  const wait = roomWaitWorld(kit);
  return {
    kit,
    runtime,
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
  actions: readonly RoomSystemAction[]
): Promise<void> {
  for (const action of actions) {
    await dispatchRoom(world, action as unknown as SystemAction);
    await world.runFor(PLAY_STEP_MS);
  }
  await prepareClientsForConverge(world);
}

function libraryAction(
  entry: LibraryArbEntry,
  weight: number,
  hooks: ModelHooks
): UnboundActionDef<SystemAction, WorldModel, RoomSystemWorld> {
  return action({
    weight,
    arb: (ctx) => asSystemArb(entry.arb(pickClient(ctx))),
    dispatch: (world, act) => dispatchRoom(world, act),
    allows: hooks.allows,
    apply: hooks.apply,
  });
}

function domainAction(
  app: RoomApp,
  hooks: ModelHooks
): UnboundActionDef<SystemAction, WorldModel, RoomSystemWorld> {
  return action({
    arb: (ctx) =>
      asSystemArb(
        fc.oneof(
          ...app.domainOpArbs({
            clientIds: defaultClientIds(ctx.ids('client')),
          })
        )
      ),
    dispatch: (world, act) => dispatchRoom(world, act),
    ...hooks,
  });
}

function roomActions(
  app: RoomApp
): Record<string, UnboundActionDef<SystemAction, WorldModel, RoomSystemWorld>> {
  const hooks: ModelHooks = {
    allows: (model, act) =>
      modelAllowsAction(app, model, act as unknown as RoomSystemAction),
    apply: (model, act) =>
      applyActionToModel(app, model, act as unknown as RoomSystemAction),
  };
  const out: Record<
    string,
    UnboundActionDef<SystemAction, WorldModel, RoomSystemWorld>
  > = {
    domain: domainAction(app, hooks),
  };
  for (const entry of SAMPLED_LIBRARY_ARBS) {
    out[entry.kind] = libraryAction(entry, 1, hooks);
  }
  for (const entry of SCRIPTED_LIBRARY_ARBS) {
    out[entry.kind] = libraryAction(entry, 0, hooks);
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
 * `@pkgs/determinism` node kinds, with per-kind library/domain actions.
 * Kit surface is merged via {@link defineSystem.extend}.
 */
export function defineRoomSystem(
  app: RoomApp,
  opts?: DefineRoomSystemOpts
): RoomSystemDef {
  const runtime = initialRoomRuntime(app, opts);
  const nodes = createRoomNodes(runtime, app);

  return defineSystem({
    id: opts?.id ?? 'room.world',
    startMs: WORLD_START_MS,
    network: {
      faults: toKernelFaults({
        oneWayDelayMeanMs: 0,
        oneWayDelayJitterMs: 0,
        packetLossProbability: 0,
      }),
      edges: [{ fromRole: 'client', toRole: 'server' }],
    },
    knobs: ROOM_SYSTEM_KNOBS,
    nodes,
    actions: roomActions(app),
    model: {
      initial: (): WorldModel => initialWorldModel(app, CLIENT_IDS),
    },
    extend: async (_world: RoomSystemWorld) =>
      kitExtension(requireKit(runtime), runtime),
    settle: async (world: RoomSystemWorld) => {
      await prepareClientsForConverge(world);
      await world.assertConverged();
    },
    invariants: async (world: RoomSystemWorld) => {
      await world.checkInvariants();
    },
  });
}
