import type { UntilContext, UntilTarget } from '@pkgs/determinism';
import type { RoomCommandPayload, RoomEvent, RoomState } from '../types';

import type { RoomCrashEvent } from './boundary-faults';
import type { RoomSimClientHandle } from './handles';
import type { RoomNetSetArg, SimRoomNetHandle } from './network';
import { type DrainCtx, drainRoomSim, flushRoomAux } from './settle';
import { type NeverOpts, never, type UntilOpts, until } from './until';
import type { World } from './world-api';
import type { WorldKernel } from './world-clients';
import { buildNodeHandle } from './world-clients';

export type AssembleWorldOpts<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
> = {
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
  readonly drainCtx: () => DrainCtx<S, C, E>;
};

/** Wire kernel ports into the public World facade. */
export function assembleWorld<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
>(k: WorldKernel<S, C, E>, opts: AssembleWorldOpts<S, C, E>): World<S, C, E> {
  const untilCtx: UntilContext = {
    clock: k.clock,
    scheduler: k.scheduler,
    seed: k.seed,
    heldSummary: () => k.network.heldSummary(),
  };
  const runFor = async (ms: number): Promise<void> => {
    await k.scheduler.runFor(ms);
    await drainRoomSim(opts.drainCtx());
  };

  /** Flush room IO before polling so until/never see post-delivery state. */
  const withAuxFlush = (target: UntilTarget): UntilTarget => {
    return async () => {
      await flushRoomAux(opts.drainCtx());
      if (typeof target === 'function') return Boolean(await target());
      return false;
    };
  };

  const world: World<S, C, E> = {
    seed: k.seed,
    topic: k.topic,
    module: k.module,
    rng: k.rng,
    clock: k.clock,
    scheduler: k.scheduler,
    storage: k.storage,
    get server() {
      return k.server;
    },
    clients: k.handles,
    addClient: opts.addClient,
    net: (clientId: string): SimRoomNetHandle => ({
      set: (next: RoomNetSetArg) => k.network.set(clientId, next),
    }),
    node: (clientId: string) => buildNodeHandle(k, clientId),
    runFor,
    until: (target, optsUntil?: UntilOpts) =>
      until(untilCtx, withAuxFlush(target), optsUntil),
    never: (target, optsNever: NeverOpts) =>
      never(untilCtx, withAuxFlush(target), optsNever),
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
    dispose: opts.dispose,
    [Symbol.asyncDispose]: opts.dispose,
  };
  return world;
}
