import type {
  RoomCommandPayload,
  RoomEvent,
  RoomState,
} from '@pkgs/room-root-shared-ts/types';
import type { RoomHarnessRuntime } from './api';
import type { RoomKernel } from './clients';
import { buildRoomHarnessNode } from './clients';
import type { RoomCrashEvent } from './edge-faults';
import type { RoomHarnessClient } from './handles';
import type { RoomHarnessNet, RoomNetSetArg } from './network';
import type { DrainCtx } from './wait-for-idle';
import { drainRoomHarness, flushRoomAux } from './wait-for-idle';
import type {
  NeverOptions,
  UntilPredicate,
  WaitUntilOptions,
} from './wait-until';
import { waitNever, waitUntil } from './wait-until';

export type AssembleKitOpts<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
> = {
  readonly addClient: (args: {
    readonly id: string;
    readonly identity?: string;
    readonly clientId?: string;
  }) => Promise<RoomHarnessClient<S, C, E>>;
  readonly recreateServer: () => Promise<void>;
  readonly prepareForIdle: () => Promise<void>;
  readonly recoverAll: () => Promise<void>;
  readonly serverCrash: () => Promise<void>;
  readonly dispose: () => Promise<void>;
  readonly domainQueries: Pick<
    RoomHarnessRuntime<S, C, E>,
    'serverSnapshot' | 'serverHash' | 'checkInvariants'
  >;
  readonly drainCtx: () => DrainCtx<S, C, E>;
};

/** Wire kernel ports into the public RoomHarnessRuntime facade. */
export function assembleRoomHarnessRuntime<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
>(
  k: RoomKernel<S, C, E>,
  opts: AssembleKitOpts<S, C, E>
): RoomHarnessRuntime<S, C, E> {
  const drainCtx = () => opts.drainCtx();
  const waitKit = () => ({
    seed: k.seed,
    ports: { scheduler: k.scheduler },
    advance: async (ms: number) => {
      await k.scheduler.runFor(ms);
      await drainRoomHarness(drainCtx());
    },
    now: () => k.clock.now(),
    flushBeforePoll: () => flushRoomAux(drainCtx()),
    heldSummary: () => k.network.heldSummary(),
  });
  const runFor = async (ms: number): Promise<void> => {
    await k.scheduler.runFor(ms);
    await drainRoomHarness(drainCtx());
  };

  const withAuxFlush = (pred: UntilPredicate): UntilPredicate => {
    return async () => {
      await flushRoomAux(drainCtx());
      return Boolean(await pred());
    };
  };

  const kit: RoomHarnessRuntime<S, C, E> = {
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
    net: (clientId: string): RoomHarnessNet => ({
      set: (next: RoomNetSetArg) => k.network.set(clientId, next),
      state: () => k.network.linkState(clientId),
      impaired: () => k.network.impaired(clientId),
      down: () => k.network.down(clientId),
    }),
    node: (clientId: string) => buildRoomHarnessNode(k, clientId),
    runFor,
    until: (target, optsUntil?: WaitUntilOptions) =>
      waitUntil(waitKit(), withAuxFlush(target), optsUntil),
    never: (target, optsNever: NeverOptions) =>
      waitNever(waitKit(), withAuxFlush(target), optsNever),
    drain: async () => {
      await drainRoomHarness(drainCtx());
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
      await drainRoomHarness(drainCtx());
    },
    isServerCrashed: () => k.serverCrashed,
    recoverAll: opts.recoverAll,
    dispose: opts.dispose,
    [Symbol.asyncDispose]: opts.dispose,
  };
  return kit;
}
