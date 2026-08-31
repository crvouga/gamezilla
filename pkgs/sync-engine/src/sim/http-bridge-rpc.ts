import type { SimScheduler } from '@pkgs/dst';
import { HttpNetworkError } from '@pkgs/http-client';
import type { SimHttpRequestBody, SimHttpResponse } from './http-bridge-types';

import type { SimEndpointId, SimNetwork } from './network';

export type SimHttpPending = Map<
  string,
  {
    readonly resolve: (v: SimHttpResponse) => void;
    readonly reject: (e: unknown) => void;
  }
>;

export type CreateSimHttpRpcArgs = {
  readonly network: SimNetwork;
  readonly clientId: SimEndpointId;
  readonly serverId: SimEndpointId;
  readonly scheduler: SimScheduler;
  readonly timeoutMs: number;
  readonly pending: SimHttpPending;
};

/** One-shot request/response over {@link SimNetwork} with timeout. */
export function createSimHttpRpc(
  args: CreateSimHttpRpcArgs
): (req: SimHttpRequestBody) => Promise<SimHttpResponse> {
  return async (req) => {
    const correlationId = req.correlationId;
    const response = new Promise<SimHttpResponse>((resolve, reject) => {
      args.pending.set(correlationId, { resolve, reject });
      args.scheduler.scheduleAfter(args.timeoutMs, () => {
        if (!args.pending.has(correlationId)) return;
        args.pending.delete(correlationId);
        reject(
          new HttpNetworkError(
            `sim http rpc timeout correlationId=${correlationId}`
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
  pending: SimHttpPending,
  message: string
): void {
  for (const [, w] of pending) {
    w.reject(new Error(message));
  }
  pending.clear();
}

/** Fail in-flight RPCs as a network drop so disconnect can drain without the scheduler. */
export function abortAllPending(
  pending: SimHttpPending,
  message: string
): void {
  for (const [, w] of pending) {
    w.reject(new HttpNetworkError(message));
  }
  pending.clear();
}
