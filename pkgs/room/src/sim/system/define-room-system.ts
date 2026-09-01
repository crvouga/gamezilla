import {
  type ActionArbContext,
  type ActionDef,
  defineAction,
  defineSystem,
  type SystemAction,
  type SystemDef,
  type World,
} from '@pkgs/determinism';
import fc from 'fast-check';

import type { InMemoryRoomStorage } from '../../server/adapters/memory';
import type { World as KitWorld } from '../world-api';
import type { RoomSystemAction } from './actions';
import type { RoomApp } from './app';
import { dispatchRoomSystemAction } from './dispatch';
import { ROOM_SYSTEM_KNOBS } from './knobs';
import {
  defaultClientIds,
  type LibraryArbEntry,
  SAMPLED_LIBRARY_ARBS,
  SCRIPTED_LIBRARY_ARBS,
} from './library-arbs';
import { roomClientNode, roomServerNode } from './node-kinds';
import { prepareClientsForConverge } from './play';
import { type RoomSystem, requireWorld } from './system';
import {
  applyActionToModel,
  CLIENT_IDS,
  initialWorldModel,
  modelAllowsAction,
  type WorldModel,
} from './world-model';

const WORLD_START_MS = 1_700_000_000_000;

/** Fixed post-step quantum after each played action (mirrors framework play). */
const PLAY_STEP_MS = 10;

export type RoomSystemWorld = World<RoomSystem, KitWorld>;
export type RoomSystemDef = SystemDef<RoomSystem, WorldModel, KitWorld>;

type RoomActionDef = ActionDef<RoomSystem, SystemAction, WorldModel, KitWorld>;

function asSystemArb(
  arb: fc.Arbitrary<RoomSystemAction>
): fc.Arbitrary<SystemAction> {
  return arb as unknown as fc.Arbitrary<SystemAction>;
}

async function dispatchRoom(
  world: RoomSystemWorld,
  action: SystemAction
): Promise<void> {
  await dispatchRoomSystemAction(
    world.facade,
    world.state.app,
    action as unknown as RoomSystemAction
  );
}

/**
 * Replay DST actions against an already-open room world. Scripted pins that
 * also poke clients imperatively use this; pure scripts use `replayRoom`.
 */
export async function playRoomActions(
  world: RoomSystemWorld,
  actions: readonly RoomSystemAction[]
): Promise<void> {
  for (const action of actions) {
    await dispatchRoom(world, action as unknown as SystemAction);
    await world.advance(PLAY_STEP_MS);
  }
  await prepareClientsForConverge(world.facade);
}

function pickClient(ctx: ActionArbContext): fc.Arbitrary<string> {
  return fc.constantFrom(...defaultClientIds(ctx.roleIds('client')));
}

function libraryAction(
  app: RoomApp,
  entry: LibraryArbEntry,
  sampled: boolean
): RoomActionDef {
  return defineAction<RoomSystem, SystemAction, WorldModel, KitWorld>({
    kind: entry.kind,
    class: 'library',
    arb: (ctx) => asSystemArb(entry.arb(pickClient(ctx))),
    dispatch: dispatchRoom,
    // Scripted-only kinds never enter generated command runs (allows false);
    // replay still dispatches them by kind.
    allows: sampled
      ? (m, a) => modelAllowsAction(app, m, a as unknown as RoomSystemAction)
      : () => false,
    apply: (m, a) =>
      applyActionToModel(app, m, a as unknown as RoomSystemAction),
  });
}

function domainAction(app: RoomApp): RoomActionDef {
  return defineAction<RoomSystem, SystemAction, WorldModel, KitWorld>({
    kind: 'domain',
    class: 'domain',
    arb: (ctx) =>
      asSystemArb(
        fc.oneof(
          ...app.domainOpArbs({
            clientIds: defaultClientIds(ctx.roleIds('client')),
          })
        )
      ),
    dispatch: dispatchRoom,
    allows: (m, a) =>
      modelAllowsAction(app, m, a as unknown as RoomSystemAction),
    apply: (m, a) =>
      applyActionToModel(app, m, a as unknown as RoomSystemAction),
  });
}

function roomActions(app: RoomApp): readonly RoomActionDef[] {
  return [
    domainAction(app),
    ...SAMPLED_LIBRARY_ARBS.map((entry) => libraryAction(app, entry, true)),
    ...SCRIPTED_LIBRARY_ARBS.map((entry) => libraryAction(app, entry, false)),
  ];
}

export type DefineRoomSystemOpts = {
  readonly id?: string;
  readonly topic?: string;
  readonly storage?: InMemoryRoomStorage;
};

/**
 * Framework-owned room world: one server + `clientCount` clients booted by
 * `@pkgs/determinism` node kinds, with per-kind library/domain actions.
 * Kit surface is `world.facade`.
 */
export function defineRoomSystem(
  app: RoomApp,
  opts?: DefineRoomSystemOpts
): RoomSystemDef {
  return defineSystem<RoomSystem, WorldModel, KitWorld>({
    id: opts?.id ?? 'room.world',
    startMs: WORLD_START_MS,
    knobs: ROOM_SYSTEM_KNOBS,
    nodes: [
      { kind: roomServerNode, role: 'server', count: 1 },
      {
        kind: roomClientNode,
        role: 'client',
        count: { fromKnob: 'clientCount' },
        idFor: (i) => `c${i}`,
      },
    ],
    state: (): RoomSystem => ({
      app,
      world: null,
      ...(opts?.topic !== undefined ? { topic: opts.topic } : {}),
      ...(opts?.storage !== undefined ? { storage: opts.storage } : {}),
    }),
    actions: roomActions(app),
    model: {
      initial: (): WorldModel => initialWorldModel(app, CLIENT_IDS),
    },
    facade: (world) => requireWorld(world.state),
    settle: async (world) => {
      const real = world.facade;
      await prepareClientsForConverge(real);
      await real.assertConverged();
    },
    invariants: async (world) => world.facade.checkInvariants(),
  });
}
