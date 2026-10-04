import type { HarnessClient } from './client';
import type { HarnessAuthStatus } from './client-factory-parts';
import { HARNESS_SERVER_NODE_ID } from './clock-skew';
import type { HarnessPubsubFault } from './edge-fault-pubsub';
import type { HarnessCrashEvent, HarnessHttpFault } from './edge-faults';
import type { RestartClientOpts } from './lifecycle';
import type { BootedHarnessKernel } from './types';

export type SkewEffect = Disposable & { restore(): void };

export type HarnessNode = {
  /** Immediate crash. */
  crash(): Promise<void>;
  /** Arm a boundary crash; dispose un-arms. */
  crash(opts: { readonly at: HarnessCrashEvent }): SkewEffect;
  restart(opts?: RestartClientOpts): Promise<HarnessClient | undefined>;
  auth(status: HarnessAuthStatus): void;
  skewClock(ms: number): SkewEffect;
  now(): number;
  httpFault(fault: HarnessHttpFault): SkewEffect;
  publishFault(count: number | 'next'): SkewEffect;
  pubsubFault(fault: HarnessPubsubFault): SkewEffect;
};

function syncDisposable(restore: () => void): SkewEffect {
  let done = false;
  const run = () => {
    if (done) return;
    done = true;
    restore();
  };
  return { restore: run, [Symbol.dispose]: run };
}

export function createHarnessNode(
  k: BootedHarnessKernel,
  nodeId: string,
  ops: {
    readonly crashClient: (id: string) => Promise<void>;
    readonly restartClient: (
      id: string,
      opts?: RestartClientOpts
    ) => Promise<HarnessClient>;
    readonly crashServer: () => Promise<void>;
    readonly restartServer: (opts?: {
      readonly preserveDb?: boolean;
      readonly localSchema?: import('@pkgs/sync-engine-client/local-schema-migrate').LocalDomainSchema;
      readonly mutationRegistry?: import('@pkgs/sync-engine-shared/mutations-types').MutationRegistry;
      readonly queryRegistry?: import('@pkgs/sync-engine-shared/queries-types').QueryRegistry;
    }) => Promise<void>;
    readonly armCrashHook: (id: string, event: HarnessCrashEvent) => void;
  }
): HarnessNode {
  function crash(): Promise<void>;
  function crash(opts: { readonly at: HarnessCrashEvent }): SkewEffect;
  function crash(opts?: {
    readonly at?: HarnessCrashEvent;
  }): Promise<void> | SkewEffect {
    if (opts?.at !== undefined) {
      const event = opts.at;
      ops.armCrashHook(nodeId, event);
      return syncDisposable(() => {
        k.faults.takeCrash(nodeId, event);
      });
    }
    if (nodeId === HARNESS_SERVER_NODE_ID) return ops.crashServer();
    return ops.crashClient(nodeId);
  }

  return {
    crash,
    async restart(opts) {
      if (nodeId === HARNESS_SERVER_NODE_ID) {
        await ops.restartServer({
          preserveDb: opts?.preserveLocalDb !== false,
          ...(opts?.localSchema !== undefined
            ? { localSchema: opts.localSchema }
            : {}),
          ...(opts?.mutationRegistry !== undefined
            ? { mutationRegistry: opts.mutationRegistry }
            : {}),
          ...(opts?.queryRegistry !== undefined
            ? { queryRegistry: opts.queryRegistry }
            : {}),
        });
        return undefined;
      }
      return ops.restartClient(nodeId, opts);
    },
    auth(status) {
      if (nodeId === HARNESS_SERVER_NODE_ID) {
        throw new Error('SyncHarnessRuntime.node(server).auth: clients only');
      }
      const meta = k.metas.get(nodeId);
      if (meta === undefined) throw new Error(`unknown client ${nodeId}`);
      k.authStatusByDevice.set(meta.deviceId, status);
    },
    skewClock(ms) {
      const prior = k.clockSkew.get(nodeId);
      k.clockSkew.set(nodeId, ms);
      return syncDisposable(() => {
        k.clockSkew.set(nodeId, prior);
      });
    },
    now: () => k.nowFor(nodeId),
    httpFault(fault) {
      k.faults.armHttpFault(nodeId, fault);
      return syncDisposable(() => {
        k.faults.clearHttpFaults(nodeId);
      });
    },
    publishFault(count) {
      if (nodeId !== HARNESS_SERVER_NODE_ID) {
        throw new Error('publishFault: server node only');
      }
      k.faults.armPublishFault(count);
      return syncDisposable(() => {
        k.faults.clearPublishFault();
      });
    },
    pubsubFault(fault) {
      if (nodeId !== HARNESS_SERVER_NODE_ID) {
        throw new Error('pubsubFault: server node only');
      }
      k.faults.armPubsubFault(fault);
      return syncDisposable(() => {
        k.faults.clearPubsubFaults();
      });
    },
  };
}
