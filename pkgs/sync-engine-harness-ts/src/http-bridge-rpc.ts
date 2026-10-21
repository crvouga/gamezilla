import type { EndpointId } from '@pkgs/harness-root-shared-ts/network-state';
import type { Scheduler as VirtualScheduler } from '@pkgs/harness-root-shared-ts/scheduler';
import { HttpNetworkError } from '@pkgs/http-client-shared-ts/http-network-error';
import type {
  HarnessHttpRequestBody,
  HarnessHttpResponse,
} from './http-bridge-types';
import type { SyncNetwork } from './network';

export type HarnessHttpPending = Map<
  string,
  {
    readonly resolve: (v: HarnessHttpResponse) => void;
    readonly reject: (e: unknown) => void;
  }
>;

export type CreateHarnessHttpRpcArgs = {
  readonly network: SyncNetwork;
  readonly clientId: EndpointId;
  readonly serverId: EndpointId;
  readonly scheduler: VirtualScheduler;
  readonly timeoutMs: number;
  readonly pending: HarnessHttpPending;
};

/** One-shot request/response over {@link SyncNetwork} with timeout. */
export function createHarnessHttpRpc(
  args: CreateHarnessHttpRpcArgs
): (req: HarnessHttpRequestBody) => Promise<HarnessHttpResponse> {
  return async (req) => {
    const correlationId = req.correlationId;
    const response = new Promise<HarnessHttpResponse>((resolve, reject) => {
      args.pending.set(correlationId, { resolve, reject });
      args.scheduler.scheduleAfter(args.timeoutMs, () => {
        if (!args.pending.has(correlationId)) return;
        args.pending.delete(correlationId);
        reject(
          new HttpNetworkError(
            `harness http rpc timeout correlationId=${correlationId}`
          )
        );
      });
    });
    // Schedule only — never await delivery (avoids drain-loop deadlock).
    args.network.send(args.clientId, args.serverId, {
      ...req,
      replyTo: args.clientId,
    });
    return response;
  };
}

export function rejectAllPending(
  pending: HarnessHttpPending,
  message: string
): void {
  for (const [, w] of pending) {
    w.reject(new Error(message));
  }
  pending.clear();
}

/** Fail in-flight RPCs as a network drop so disconnect can drain without the scheduler. */
export function abortAllPending(
  pending: HarnessHttpPending,
  message: string
): void {
  for (const [, w] of pending) {
    w.reject(new HttpNetworkError(message));
  }
  pending.clear();
}
