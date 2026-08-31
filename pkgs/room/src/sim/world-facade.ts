import type { RoomCommandPayload, RoomEvent, RoomState } from '../types';

import type { RoomCrashEvent } from './boundary-faults';
import type { RoomDstApp } from './dst/app';
import type { RoomWorldKnobs } from './dst/knobs';
import { playActionsOnWorld } from './dst/play';
import { runCommandsOnWorld } from './dst/run-commands';
import type { RoomNetSetArg, SimRoomNetHandle } from './network';
import { drainRoomSim } from './settle';
import {
  type NeverOpts,
  runWorldNever,
  runWorldUntil,
  type UntilOpts,
  type UntilTarget,
} from './until';
import type { RoomSimClientHandle, World } from './world-api';
import type { WorldKernel } from './world-clients';
import { buildNodeHandle } from './world-clients';

export type AssembleWorldOpts<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
> = {
  readonly dstApp?: RoomDstApp;
  readonly knobs?: RoomWorldKnobs | null;
  readonly clientIds: string[];
  readonly addClient: (args: {
    readonly id: string;
    readonly identity?: string;
    readonly clientId?: string;
  }) => Promise<RoomSimClientHandle<S, C, E>>;
  readonly recreateServer: () => Promise<void>;
  readonly prepareForSettle: () => Promise<void>;
  readonly assertConverged: () => Promise<void>;
  readonly serverCrash: () => Promise<void>;
  readonly dispose: () => Promise<void>;
  readonly domainQueries: Pick<
    World<S, C, E>,
    'serverSnapshot' | 'serverHash' | 'checkInvariants'
  >;
  readonly drainCtx: () => Parameters<typeof drainRoomSim>[0];
};

/** Wire kernel ports into the public World facade. */
export function assembleWorld<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
>(k: WorldKernel<S, C, E>, opts: AssembleWorldOpts<S, C, E>): World<S, C, E> {
  const step = async (ms: number): Promise<void> => {
    k.clock.advance(ms);
    await drainRoomSim(opts.drainCtx());
  };
  const untilCtx = { clock: k.clock, seed: k.seed, step };
  const dstApp = opts.dstApp;
  const requireApp = (): RoomDstApp => {
    if (dstApp === undefined) {
      throw new Error('DST method requires openWorld({ app })');
    }
    return dstApp;
  };

  const world: World<S, C, E> = {
    seed: k.seed,
    topic: k.topic,
    module: k.module,
    rng: k.rng,
    clock: k.clock,
    storage: k.storage,
    get server() {
      return k.server;
    },
    clients: k.handles,
    clientIds: opts.clientIds,
    knobs: opts.knobs ?? null,
    addClient: opts.addClient,
    net: (clientId: string): SimRoomNetHandle => ({
      set: (next: RoomNetSetArg) => k.network.set(clientId, next),
    }),
    node: (clientId: string) => buildNodeHandle(k, clientId),
    runFor: async (ms: number) => {
      await step(ms);
    },
    until: (target: UntilTarget, optsUntil?: UntilOpts) =>
      runWorldUntil(untilCtx, target, optsUntil),
    never: (target: UntilTarget, optsNever: NeverOpts) =>
      runWorldNever(untilCtx, target, optsNever),
    drain: async () => {
      await drainRoomSim(opts.drainCtx());
    },
    ...opts.domainQueries,
    armCrashAt: (clientId: string, event: RoomCrashEvent) => {
      k.boundary.armCrash(clientId, event);
    },
    clearBoundaryFaults: () => {
      k.boundary.clearCrashArms();
    },
    serverCrash: opts.serverCrash,
    serverRestart: async () => {
      await opts.recreateServer();
      await drainRoomSim(opts.drainCtx());
    },
    isServerCrashed: () => k.serverCrashed,
    assertConverged: opts.assertConverged,
    playActions: (actions) =>
      playActionsOnWorld(requireApp(), world as unknown as World, actions),
    runCommands: async (cmds) => {
      await runCommandsOnWorld({
        app: requireApp(),
        world: world as unknown as World,
        cmds,
      });
    },
    dispose: opts.dispose,
    [Symbol.asyncDispose]: opts.dispose,
  };
  return world;
}
