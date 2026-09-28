import { formatCheckpoint } from '../shared/commit-checkpoint';
import { crashBrokerImpl, restartBrokerImpl } from './broker-restart';
import { HARNESS_SERVER_NODE_ID } from './clock-skew';
import type { SyncHarnessRuntime } from './harness-api';
import type { HarnessClient } from './harness-client';
import {
  crashClientImpl,
  fireCrashIfArmed,
  type KitFaultApi,
} from './harness-lifecycle';
import { createHarnessNode } from './harness-node';
import { drainUntilInSyncImpl, recoverAllImpl } from './harness-ops';
import { addClientImpl } from './harness-ops-add-client';
import { restartClientImpl, restartServerImpl } from './harness-restart';
import type { BootedHarnessKernel } from './harness-types';
import {
  checkClientFrameworkInvariants,
  type InvariantViolation,
  isClosedDatabaseError,
} from './invariants';
import type { NetEffectRegistry } from './net-effect';
import { createHarnessNet } from './net-effect';
import { unregisterKit } from './scenario-dispose-hook';
import { tamperClientLocalStorage } from './storage-faults';

export async function checkClientSeqs(
  clients: ReadonlyMap<string, HarnessClient>,
  seed: bigint,
  now: () => number
): Promise<InvariantViolation | null> {
  for (const c of clients.values()) {
    let seq: InvariantViolation | null;
    try {
      // Read through the client's serialized transaction queue: a bare query
      // on the shared connection can observe an in-flight transaction
      // half-applied (rejection stored, queue row not yet acked).
      seq = await c.db.transaction((tx) => checkClientFrameworkInvariants(tx));
    } catch (error) {
      if (isClosedDatabaseError(error)) continue;
      if (error instanceof Error && error.name === 'SqliteStorageFullError') {
        continue;
      }
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
function restoreNonRevokedAuth(k: BootedHarnessKernel): void {
  for (const meta of k.metas.values()) {
    if (k.authStatusByDevice.get(meta.deviceId) === 'revoked') continue;
    k.authStatusByDevice.set(meta.deviceId, 'valid');
  }
}

export function createArmCrashHook(
  k: BootedHarnessKernel,
  faultApi: KitFaultApi
): (nodeId: string, event: Parameters<KitFaultApi['armCrash']>[1]) => void {
  return (nodeId, event) => {
    faultApi.armCrash(nodeId, event);
    if (event === 'onNextTimerTickWhileSyncUndelivered') {
      k.scheduler.scheduleAfter(0, () => {
        void fireCrashIfArmed(k, nodeId, event);
      });
    }
  };
}

function bindNodeAndNet(args: {
  readonly k: BootedHarnessKernel;
  readonly netEffects: NetEffectRegistry;
  readonly armCrashHook: ReturnType<typeof createArmCrashHook>;
  readonly crashServer: () => Promise<void>;
}): Pick<SyncHarnessRuntime, 'net' | 'node'> {
  const { k, netEffects, armCrashHook, crashServer } = args;
  const { clients, network } = k;
  return {
    net: (nodeId, traffic = 'all') =>
      createHarnessNet({
        network,
        nodeId,
        traffic,
        registry: netEffects,
        onHoldReleased: (id) => {
          clients.get(id)?.engine.wakeUploads();
        },
      }),
    node: (id) =>
      createHarnessNode(k, id, {
        crashClient: (cid) => crashClientImpl(k, cid, { keepDb: true }),
        restartClient: (cid, opts) => restartClientImpl(k, cid, opts),
        crashServer,
        restartServer: (opts) => restartServerImpl(k, opts),
        armCrashHook,
      }),
  };
}

function clearEdgeFaults(faultApi: KitFaultApi): void {
  faultApi.clearCrashArms();
  faultApi.clearHttpFaults();
  faultApi.clearPublishFault();
  faultApi.clearPubsubFaults();
}

function clearFaultArms(k: BootedHarnessKernel, faultApi: KitFaultApi): void {
  clearEdgeFaults(faultApi);
  k.storagePressure.clear();
}

async function healInfraForSettle(k: BootedHarnessKernel): Promise<void> {
  const fromAllocator = k.server.checkpointHighWater();
  const fromClock = BigInt(
    formatCheckpoint(k.nowFor(HARNESS_SERVER_NODE_ID), 999_999)
  );
  const checkpointFloor = fromAllocator > fromClock ? fromAllocator : fromClock;
  k.clockSkew.set(HARNESS_SERVER_NODE_ID, 0);
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
  restoreNonRevokedAuth(k);
}

function createKitDispose(args: {
  readonly k: BootedHarnessKernel;
  readonly kitRef: { current: SyncHarnessRuntime | null };
  readonly markDisposed: () => boolean;
}): () => Promise<void> {
  const { k, kitRef, markDisposed } = args;
  return async () => {
    if (markDisposed()) return;
    const kit = kitRef.current;
    if (kit !== null) unregisterKit(kit);
    const closedRaw = new Set<HarnessClient['dbBundle']['raw']>();
    for (const c of [...k.clients.values()]) {
      const raw = c.dbBundle.raw;
      await c.dispose({ keepDb: closedRaw.has(raw) });
      closedRaw.add(raw);
    }
    k.clients.clear();
    k.unbindHttp();
    k.broker.dispose();
    await k.server.dispose();
  };
}

export function bindKitMethods(args: {
  readonly k: BootedHarnessKernel;
  readonly netEffects: NetEffectRegistry;
  readonly armCrashHook: ReturnType<typeof createArmCrashHook>;
  readonly crashServer: () => Promise<void>;
  readonly faultApi: KitFaultApi;
  readonly kitRef: { current: SyncHarnessRuntime | null };
  readonly markDisposed: () => boolean;
}): Omit<SyncHarnessRuntime, typeof Symbol.asyncDispose> & {
  [Symbol.asyncDispose](): Promise<void>;
} {
  const { k, netEffects, armCrashHook, crashServer, faultApi } = args;
  const { clients, scheduler, network, rng, domain } = k;
  const { net, node } = bindNodeAndNet({
    k,
    netEffects,
    armCrashHook,
    crashServer,
  });
  const dispose = createKitDispose(args);

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
    isSchedulerQuiescent: () => scheduler.pendingTaskCount() === 0,
    pendingEventCount: () => scheduler.pendingTaskCount(),
    checkInvariants: () =>
      checkClientSeqs(clients, rng.seed, () => k.clock.now()),
    recoverAll: () =>
      recoverAllImpl({
        network,
        clients,
        netEffects,
        clearEdgeFaults: () => clearFaultArms(k, faultApi),
        restoreInfra: () => healInfraForSettle(k),
      }),
    drainUntilInSync: () =>
      drainUntilInSyncImpl({
        scheduler,
        clients,
        server: k.server,
        seed: rng.seed,
        domain,
        now: () => k.clock.now(),
      }),
    tamperLocalStorage: (clientId, tamper) =>
      tamperClientLocalStorage(k, clientId, tamper),
    armStoragePressure: (clientId, kind, afterStatements) => {
      k.storagePressure.arm(clientId, kind, afterStatements);
    },
    clearStoragePressure: (clientId) => {
      k.storagePressure.clear(clientId);
    },
    armFailNextOpen: (clientId) => {
      k.failNextOpenClients.add(clientId);
    },
    clearFailNextOpen: (clientId) => {
      if (clientId === undefined) {
        k.failNextOpenClients.clear();
        return;
      }
      k.failNextOpenClients.delete(clientId);
    },
    brokerCrash: () => {
      crashBrokerImpl(k);
    },
    brokerRestart: () => restartBrokerImpl(k),
    clearEdgeFaults: () => clearFaultArms(k, faultApi),
    dispose,
    async [Symbol.asyncDispose]() {
      await dispose();
    },
  };
}
