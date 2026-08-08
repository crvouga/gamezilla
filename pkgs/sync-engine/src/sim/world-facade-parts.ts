import type { SimClientHandle } from './client-handle';
import { checkSeqMonotonicity, type InvariantViolation } from './invariants';
import type { NetEffectRegistry } from './net-effect';
import { createSimNetHandle } from './net-effect';
import { createSimNodeHandle } from './node-handle';
import { unregisterSimWorld } from './scenario-dispose-hook';
import type { UntilContext } from './until';
import { runWorldNever, runWorldUntil } from './until';
import type { SimWorld } from './world-api';
import {
  crashClientImpl,
  fireCrashIfArmed,
  type WorldFaultApi,
} from './world-lifecycle';
import { assertConvergedImpl } from './world-ops';
import { addClientImpl } from './world-ops-add-client';
import { restartClientImpl, restartServerImpl } from './world-restart';
import type { BootedSimKernel } from './world-types';

export async function checkClientSeqs(
  clients: ReadonlyMap<string, SimClientHandle>,
  seed: bigint,
  now: () => number
): Promise<InvariantViolation | null> {
  for (const c of clients.values()) {
    const seq = await checkSeqMonotonicity(c.db);
    if (seq !== null) {
      return {
        ...seq,
        detail: `seed=${seed.toString(16)} now=${now()} ${seq.detail}`,
      };
    }
  }
  return null;
}

export function createArmCrashHook(
  k: BootedSimKernel,
  faultApi: WorldFaultApi
): (nodeId: string, event: Parameters<WorldFaultApi['armCrash']>[1]) => void {
  return (nodeId, event) => {
    faultApi.armCrash(nodeId, event);
    if (event === 'onNextTimerTickWhileSyncUndelivered') {
      k.scheduler.scheduleAfter(0, () => {
        void fireCrashIfArmed(k, nodeId, event);
      });
    }
  };
}

function untilCtx(k: BootedSimKernel): UntilContext {
  return {
    clock: k.clock,
    scheduler: k.scheduler,
    seed: k.rng.seed,
    heldSummary: () => k.network.heldSummary(),
  };
}

function bindNodeAndNet(args: {
  readonly k: BootedSimKernel;
  readonly netEffects: NetEffectRegistry;
  readonly armCrashHook: ReturnType<typeof createArmCrashHook>;
  readonly crashServer: () => Promise<void>;
}): Pick<SimWorld, 'net' | 'node'> {
  const { k, netEffects, armCrashHook, crashServer } = args;
  const { clients, network } = k;
  return {
    net: (nodeId, traffic = 'all') =>
      createSimNetHandle({
        network,
        nodeId,
        traffic,
        registry: netEffects,
        onHoldReleased: (id) => {
          clients.get(id)?.engine.wakeUploads();
        },
      }),
    node: (id) =>
      createSimNodeHandle(k, id, {
        crashClient: (cid) => crashClientImpl(k, cid),
        restartClient: (cid, opts) => restartClientImpl(k, cid, opts),
        crashServer,
        restartServer: (opts) => restartServerImpl(k, opts),
        armCrashHook,
      }),
  };
}

export function bindWorldMethods(args: {
  readonly k: BootedSimKernel;
  readonly netEffects: NetEffectRegistry;
  readonly armCrashHook: ReturnType<typeof createArmCrashHook>;
  readonly crashServer: () => Promise<void>;
  readonly worldRef: { current: SimWorld | null };
  readonly markDisposed: () => boolean;
}): Omit<SimWorld, typeof Symbol.asyncDispose> & {
  [Symbol.asyncDispose](): Promise<void>;
} {
  const { k, netEffects, armCrashHook, crashServer, worldRef, markDisposed } =
    args;
  const { clients, scheduler, network, broker, rng, domain } = k;
  const ctx = untilCtx(k);
  const { net, node } = bindNodeAndNet({
    k,
    netEffects,
    armCrashHook,
    crashServer,
  });

  const dispose = async () => {
    if (markDisposed()) return;
    const world = worldRef.current;
    if (world !== null) unregisterSimWorld(world);
    for (const c of [...clients.values()]) await c.dispose();
    clients.clear();
    k.unbindHttp();
    broker.dispose();
    await k.server.dispose();
  };

  return {
    seed: rng.seed,
    clock: k.clock,
    rng,
    scheduler,
    network,
    get server() {
      return k.server;
    },
    clients,
    nextId: k.nextId,
    addClient: (clientArgs) => addClientImpl(k, clientArgs),
    net,
    node,
    until: (target, opts) => runWorldUntil(ctx, target, opts),
    never: (target, opts) => runWorldNever(ctx, target, opts),
    runFor: (ms) => scheduler.runFor(ms),
    runUntilIdle: (opts) => scheduler.runUntilIdle(opts),
    isSchedulerQuiescent: () => scheduler.pendingCount() === 0,
    pendingEventCount: () => scheduler.pendingCount(),
    checkInvariants: () =>
      checkClientSeqs(clients, rng.seed, () => k.clock.now()),
    assertConverged: () =>
      assertConvergedImpl({
        network,
        scheduler,
        clients,
        server: k.server,
        seed: rng.seed,
        domain,
        netEffects,
        now: () => k.clock.now(),
      }),
    dispose,
    async [Symbol.asyncDispose]() {
      await dispose();
    },
  };
}
