import {
  defineLibrary,
  defineSystem,
  type JsonValue,
  playActionsOnWorld,
  type SystemDef,
  type World,
} from '@pkgs/determinism';
import fc from 'fast-check';

import type { RoomSystemAction } from './actions';
import { isLibraryAction } from './actions';
import type { RoomApp } from './app';
import { dispatchRoomSystemAction } from './dispatch';
import { ROOM_SYSTEM_KNOBS } from './knobs';
import { defaultClientIds, libraryActionArbs } from './library-arbs';
import { ROOM_CLIENT, ROOM_SERVER } from './node-kinds';
import { prepareClientsForConverge, prepareReplayAction } from './play';
import { type RoomSystem, requireWorld } from './system';
import {
  applyActionToModel,
  CLIENT_IDS,
  initialWorldModel,
  modelAllowsAction,
  type WorldModel,
} from './world-model';

const WORLD_START_MS = 1_700_000_000_000;

export type RoomSystemWorld = World<RoomSystem>;
export type RoomSystemDef = SystemDef<RoomSystem>;

function asJsonArb<T>(arb: fc.Arbitrary<T>): fc.Arbitrary<JsonValue> {
  return arb as unknown as fc.Arbitrary<JsonValue>;
}

async function dispatchRoom(
  world: RoomSystemWorld,
  action: JsonValue
): Promise<void> {
  const system = world.system;
  const real = requireWorld(system);
  const roomAction = action as unknown as RoomSystemAction;
  await prepareReplayAction(real, roomAction);
  await dispatchRoomSystemAction(real, system.app, roomAction);
}

async function roomPrepareConverge(world: RoomSystemWorld): Promise<void> {
  await prepareClientsForConverge(requireWorld(world.system));
}

/**
 * Replay DST actions against an already-open room world. Scripted pins that
 * also poke clients imperatively use this; pure scripts use `replayRoom`.
 */
export async function playRoomActions(
  world: RoomSystemWorld,
  actions: readonly RoomSystemAction[]
): Promise<void> {
  await playActionsOnWorld<JsonValue>({
    host: world,
    actions: actions as unknown as readonly JsonValue[],
    dispatch: (action) => dispatchRoom(world, action),
    prepareConverge: () => roomPrepareConverge(world),
  });
}

function roomLibrary() {
  return defineLibrary<RoomSystem>({
    kind: 'library',
    match: (action) => isLibraryAction(action as unknown as RoomSystemAction),
    arb: (ctx) =>
      fc.oneof(
        ...libraryActionArbs({ clientIds: ctx.roleIds('client') }).map(
          asJsonArb
        )
      ),
    dispatch: dispatchRoom,
  });
}

function roomDomainArbs(
  app: RoomApp,
  clientIds: readonly string[]
): readonly fc.Arbitrary<JsonValue>[] {
  return app
    .domainOpArbs({ clientIds: defaultClientIds(clientIds) })
    .map(asJsonArb);
}

function roomModel(app: RoomApp) {
  return {
    initial: (): object => initialWorldModel(app, CLIENT_IDS),
    allows: (model: object, action: JsonValue): boolean =>
      modelAllowsAction(
        app,
        model as WorldModel,
        action as unknown as RoomSystemAction
      ),
    apply: (model: object, action: JsonValue): void => {
      applyActionToModel(
        app,
        model as WorldModel,
        action as unknown as RoomSystemAction
      );
    },
  };
}

export type DefineRoomSystemOpts = {
  readonly id?: string;
};

/**
 * Framework-owned room world: one server + `clientCount` clients booted by
 * `@pkgs/determinism` node kinds, with the full library/domain action pool.
 */
export function defineRoomSystem(
  app: RoomApp,
  opts?: DefineRoomSystemOpts
): RoomSystemDef {
  return defineSystem<RoomSystem>({
    id: opts?.id ?? 'room.world',
    startMs: WORLD_START_MS,
    knobs: ROOM_SYSTEM_KNOBS,
    nodes: [
      { kind: ROOM_SERVER, role: 'server', count: 1 },
      {
        kind: ROOM_CLIENT,
        role: 'client',
        countFromKnob: 'clientCount',
        idFor: (i) => `c${i}`,
      },
    ],
    system: (): RoomSystem => ({ app, world: null }),
    library: [roomLibrary()],
    domain: {
      arbs: (ctx) => roomDomainArbs(app, ctx.roleIds('client')),
      dispatch: dispatchRoom,
    },
    model: roomModel(app),
    checkInvariants: (world) => requireWorld(world.system).checkInvariants(),
    prepareConverge: roomPrepareConverge,
    settle: async (world) => {
      await requireWorld(world.system).assertConverged();
    },
  });
}
