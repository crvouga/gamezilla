import { formatCheckpoint } from '../shared/commit-checkpoint';
import { crashBrokerImpl, restartBrokerImpl } from './broker-restart';
import type { SimClientHandle } from './client-handle';
import { SIM_SERVER_NODE_ID } from './clock-skew';
import {
  checkSeqMonotonicity,
  type InvariantViolation,
  isClosedDatabaseError,
} from './invariants';
import type { NetEffectRegistry } from './net-effect';
import { createSimNetHandle } from './net-effect';
import { createSimNodeHandle } from './node-handle';
import { unregisterSimWorld } from './scenario-dispose-hook';
import { tamperClientLocalStorage } from './storage-faults';
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
    let seq: InvariantViolation | null;
    try {
      seq = await checkSeqMonotonicity(c.db);
    } catch (error) {
      if (isClosedDatabaseError(error)) continue;
      throw error;
    }
    if (seq !== null) {
      return {
        ...seq,
        detail: `seed=${seed.toString(16)} now=${now()} ${seq.detail}`,
      };
    }
  }
  return null;
}

/** Protocol-cut / expired: restore so queued mutations can drain. */
function restoreNonRevokedAuth(k: BootedSimKernel): void {
  for (const meta of k.metas.values()) {
    if (k.authStatusByDevice.get(meta.deviceId) === 'revoked') continue;
    k.authStatusByDevice.set(meta.deviceId, 'valid');
  }
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
        // Process crash keeps sqlite so settle can drain pending mutations.
        crashClient: (cid) => crashClientImpl(k, cid, { keepDb: true }),
        restartClient: (cid, opts) => restartClientImpl(k, cid, opts),
        crashServer,
        restartServer: (opts) => restartServerImpl(k, opts),
        armCrashHook,
      }),
  };
}

function clearBoundaryFaults(faultApi: WorldFaultApi): void {
  faultApi.clearCrashArms();
  faultApi.clearHttpFaults();
  faultApi.clearPublishFault();
  faultApi.clearPubsubFaults();
}

async function healInfraForSettle(k: BootedSimKernel): Promise<void> {
  // Query checkpoints embed server `now()`. Prefer the live allocator's
  // high-water mark: prepareClientsForConverge may already have cleared
  // forward skew, so clock-based floor alone underestimates what clients hold.
  const fromAllocator = k.server.checkpointHighWater();
  const fromClock = BigInt(
    formatCheckpoint(k.nowFor(SIM_SERVER_NODE_ID), 999_999)
  );
  const checkpointFloor = fromAllocator > fromClock ? fromAllocator : fromClock;
  k.clockSkew.set(SIM_SERVER_NODE_ID, 0);
  for (const id of k.clients.keys()) {
    k.clockSkew.set(id, 0);
  }
  try {
    await restartServerImpl(k, {
      preserveDb: true,
      checkpointFloor,
    });
  } catch {
    // already running
  }
  // Do not restart a healthy broker here — that remakes every client's MQTT
  // session and drops in-flight row-image fanout (breaks partial-query peers
  // and remake-count assertions). DST `heal` / prepareClientsForConverge
  // still call brokerRestart after chaos.
  restoreNonRevokedAuth(k);
}

function createWorldDispose(args: {
  readonly k: BootedSimKernel;
  readonly worldRef: { current: SimWorld | null };
  readonly markDisposed: () => boolean;
}): () => Promise<void> {
  const { k, worldRef, markDisposed } = args;
  return async () => {
    if (markDisposed()) return;
    const world = worldRef.current;
    if (world !== null) unregisterSimWorld(world);
    for (const c of [...k.clients.values()]) await c.dispose();
    k.clients.clear();
    k.unbindHttp();
    k.broker.dispose();
    await k.server.dispose();
  };
}

export function bindWorldMethods(args: {
  readonly k: BootedSimKernel;
  readonly netEffects: NetEffectRegistry;
  readonly armCrashHook: ReturnType<typeof createArmCrashHook>;
  readonly crashServer: () => Promise<void>;
  readonly faultApi: WorldFaultApi;
  readonly worldRef: { current: SimWorld | null };
  readonly markDisposed: () => boolean;
}): Omit<SimWorld, typeof Symbol.asyncDispose> & {
  [Symbol.asyncDispose](): Promise<void>;
} {
  const { k, netEffects, armCrashHook, crashServer, faultApi } = args;
  const { clients, scheduler, network, rng, domain } = k;
  const ctx = untilCtx(k);
  const { net, node } = bindNodeAndNet({
    k,
    netEffects,
    armCrashHook,
    crashServer,
  });
  const dispose = createWorldDispose(args);

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
        clearBoundaryFaults: () => clearBoundaryFaults(faultApi),
        healInfra: () => healInfraForSettle(k),
      }),
    tamperLocalStorage: (clientId, tamper) =>
      tamperClientLocalStorage(k, clientId, tamper),
    brokerCrash: () => {
      crashBrokerImpl(k);
    },
    brokerRestart: () => restartBrokerImpl(k),
    clearBoundaryFaults: () => clearBoundaryFaults(faultApi),
    dispose,
    async [Symbol.asyncDispose]() {
      await dispose();
    },
  };
}
