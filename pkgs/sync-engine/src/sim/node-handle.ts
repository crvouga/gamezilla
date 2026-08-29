import type {
  SimCrashEvent,
  SimHttpFault,
  SimPubsubFault,
} from './boundary-faults';
import type { SimAuthStatus, SimClientHandle } from './client-factory';
import { SIM_SERVER_NODE_ID } from './clock-skew';
import type { RestartClientOpts } from './world-lifecycle';
import type { BootedSimKernel } from './world-types';

export type SkewEffect = Disposable & { restore(): void };

export type SimNodeHandle = {
  /** Immediate crash. */
  crash(): Promise<void>;
  /** Arm a boundary crash; dispose un-arms. */
  crash(opts: { readonly at: SimCrashEvent }): SkewEffect;
  restart(opts?: RestartClientOpts): Promise<SimClientHandle | undefined>;
  auth(status: SimAuthStatus): void;
  skewClock(ms: number): SkewEffect;
  now(): number;
  httpFault(fault: SimHttpFault): SkewEffect;
  publishFault(count: number | 'next'): SkewEffect;
  pubsubFault(fault: SimPubsubFault): SkewEffect;
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

export function createSimNodeHandle(
  k: BootedSimKernel,
  nodeId: string,
  ops: {
    readonly crashClient: (id: string) => Promise<void>;
    readonly restartClient: (
      id: string,
      opts?: RestartClientOpts
    ) => Promise<SimClientHandle>;
    readonly crashServer: () => Promise<void>;
    readonly restartServer: (opts?: {
      readonly preserveDb?: boolean;
      readonly localSchema?: import('../client/local-schema-migrate').LocalDomainSchema;
      readonly mutationRegistry?: import('../mutations/core/types').MutationRegistry;
      readonly queryRegistry?: import('../queries/core/types').QueryRegistry;
    }) => Promise<void>;
    readonly armCrashHook: (id: string, event: SimCrashEvent) => void;
  }
): SimNodeHandle {
  function crash(): Promise<void>;
  function crash(opts: { readonly at: SimCrashEvent }): SkewEffect;
  function crash(opts?: {
    readonly at?: SimCrashEvent;
  }): Promise<void> | SkewEffect {
    if (opts?.at !== undefined) {
      const event = opts.at;
      ops.armCrashHook(nodeId, event);
      return syncDisposable(() => {
        k.faults.takeCrash(nodeId, event);
      });
    }
    if (nodeId === SIM_SERVER_NODE_ID) return ops.crashServer();
    return ops.crashClient(nodeId);
  }

  return {
    crash,
    async restart(opts) {
      if (nodeId === SIM_SERVER_NODE_ID) {
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
      if (nodeId === SIM_SERVER_NODE_ID) {
        throw new Error('SimWorld.node(server).auth: clients only');
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
      if (nodeId !== SIM_SERVER_NODE_ID) {
        throw new Error('publishFault: server node only');
      }
      k.faults.armPublishFault(count);
      return syncDisposable(() => {
        k.faults.clearPublishFault();
      });
    },
    pubsubFault(fault) {
      if (nodeId !== SIM_SERVER_NODE_ID) {
        throw new Error('pubsubFault: server node only');
      }
      k.faults.armPubsubFault(fault);
      return syncDisposable(() => {
        k.faults.clearPubsubFaults();
      });
    },
  };
}
