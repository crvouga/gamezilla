import type { RoomCommandPayload, RoomEvent, RoomState } from '../types';

import type { RoomCrashEvent } from './edge-faults';
import type { RoomNetSetArg, RoomSimNet } from './network';
import type { RoomSimRuntime } from './sim-api';
import type { RoomKernel } from './sim-clients';
import { buildRoomSimNode } from './sim-clients';
import type { RoomSimClient } from './sim-handles';
import { type DrainCtx, drainRoomSim, flushRoomAux } from './wait-for-idle';
import {
  type NeverOptions,
  type UntilPredicate,
  type WaitUntilOptions,
  waitNever,
  waitUntil,
} from './wait-until';

export type AssembleKitOpts<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
> = {
  readonly addClient: (args: {
    readonly id: string;
    readonly identity?: string;
    readonly clientId?: string;
  }) => Promise<RoomSimClient<S, C, E>>;
  readonly recreateServer: () => Promise<void>;
  readonly prepareForIdle: () => Promise<void>;
  readonly recoverAll: () => Promise<void>;
  readonly serverCrash: () => Promise<void>;
  readonly dispose: () => Promise<void>;
  readonly domainQueries: Pick<
    RoomSimRuntime<S, C, E>,
    'serverSnapshot' | 'serverHash' | 'checkInvariants'
  >;
  readonly drainCtx: () => DrainCtx<S, C, E>;
};

/** Wire kernel ports into the public RoomSimRuntime facade. */
export function assembleRoomSimRuntime<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
>(
  k: RoomKernel<S, C, E>,
  opts: AssembleKitOpts<S, C, E>
): RoomSimRuntime<S, C, E> {
  const drainCtx = () => opts.drainCtx();
  const waitKit = () => ({
    seed: k.seed,
    ports: { scheduler: k.scheduler },
    advance: async (ms: number) => {
      await k.scheduler.runFor(ms);
      await drainRoomSim(drainCtx());
    },
    now: () => k.clock.now(),
    until: (() => Promise.resolve(0)) as never,
    never: (() => Promise.resolve()) as never,
    flushBeforePoll: () => flushRoomAux(drainCtx()),
    heldSummary: () => k.network.heldSummary(),
  });
  const runFor = async (ms: number): Promise<void> => {
    await k.scheduler.runFor(ms);
    await drainRoomSim(drainCtx());
  };

  const withAuxFlush = (pred: UntilPredicate): UntilPredicate => {
    return async () => {
      await flushRoomAux(drainCtx());
      return Boolean(await pred());
    };
  };

  const kit: RoomSimRuntime<S, C, E> = {
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
    net: (clientId: string): RoomSimNet => ({
      set: (next: RoomNetSetArg) => k.network.set(clientId, next),
      state: () => k.network.linkState(clientId),
      impaired: () => k.network.impaired(clientId),
      down: () => k.network.down(clientId),
    }),
    node: (clientId: string) => buildRoomSimNode(k, clientId),
    runFor,
    until: (target, optsUntil?: WaitUntilOptions) =>
      waitUntil(waitKit(), withAuxFlush(target), optsUntil),
    never: (target, optsNever: NeverOptions) =>
      waitNever(waitKit(), withAuxFlush(target), optsNever),
    waitUntil: (target, optsUntil?: WaitUntilOptions) =>
      waitUntil(waitKit(), withAuxFlush(target), optsUntil),
    waitNever: (target, optsNever: NeverOptions) =>
      waitNever(waitKit(), withAuxFlush(target), optsNever),
    drain: async () => {
      await drainRoomSim(drainCtx());
    },
    ...opts.domainQueries,
    armCrashAt: (clientId: string, event: RoomCrashEvent) => {
      k.boundary.armCrash(clientId, event);
    },
    clearEdgeFaults: () => {
      k.boundary.clearCrashArms();
    },
    serverCrash: opts.serverCrash,
    serverRestart: async () => {
      await opts.recreateServer();
      await drainRoomSim(drainCtx());
    },
    isServerCrashed: () => k.serverCrashed,
    recoverAll: opts.recoverAll,
    dispose: opts.dispose,
    [Symbol.asyncDispose]: opts.dispose,
  };
  return kit;
}
