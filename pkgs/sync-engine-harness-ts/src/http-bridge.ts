import type { EndpointId } from '@pkgs/harness-root-shared-ts/network-state';
import type { Scheduler as VirtualScheduler } from '@pkgs/harness-root-shared-ts/scheduler';
import type {
  MutationUploadResult,
  MutationUploadRow,
} from '@pkgs/sync-engine-client-ts/mutation-upload-queue';
import { validateWireQueryBatch } from '@pkgs/sync-engine-client-ts/query-wire-validation';
import type { QueryRequest } from '@pkgs/sync-engine-client-ts/subscription-runtime';
import { SyncApiAuthError } from '@pkgs/sync-engine-client-ts/sync-http-client';
import { SyncHttpRateLimitError } from '@pkgs/sync-engine-client-ts/sync-http-rate-limit-error';
import type { QueryResponse } from '@pkgs/sync-engine-shared-ts/v2';
import type { EdgeFaultController } from './edge-faults';
import { dispatchHarnessHttpRequest } from './http-bridge-dispatch';
import type { HarnessHttpPending } from './http-bridge-rpc';
import {
  abortAllPending,
  createHarnessHttpRpc,
  rejectAllPending,
} from './http-bridge-rpc';
import type {
  HarnessHttpRequest,
  HarnessHttpResponse,
  HarnessHttpServerHandlers,
} from './http-bridge-types';
import type { SyncNetwork } from './network';
import { classifyEndpoint } from './traffic';

function isHttpRequest(value: unknown): value is HarnessHttpRequest {
  if (value === null || typeof value !== 'object') return false;
  const r = value as Record<string, unknown>;
  return (
    typeof r['kind'] === 'string' &&
    typeof r['correlationId'] === 'string' &&
    typeof r['replyTo'] === 'string'
  );
}

function isHttpResponse(value: unknown): value is HarnessHttpResponse {
  if (value === null || typeof value !== 'object') return false;
  const r = value as Record<string, unknown>;
  return typeof r['correlationId'] === 'string' && 'ok' in r;
}

export function bindHarnessHttpServer(args: {
  readonly network: SyncNetwork;
  readonly serverId: EndpointId;
  readonly handlers: HarnessHttpServerHandlers;
  readonly faults?: EdgeFaultController;
  readonly onMutationsAccepted?: (clientNodeId: string) => void | Promise<void>;
}): () => void {
  args.network.register(args.serverId, async (payload) => {
    if (!isHttpRequest(payload)) return;
    await dispatchHarnessHttpRequest({
      payload,
      serverId: args.serverId,
      network: args.network,
      handlers: args.handlers,
      ...(args.faults !== undefined ? { faults: args.faults } : {}),
      ...(args.onMutationsAccepted !== undefined
        ? { onMutationsAccepted: args.onMutationsAccepted }
        : {}),
    });
  });

  return () => args.network.unregister(args.serverId);
}

/** Round-robin ingress over independent server handlers sharing one DB. */
export function bindHarnessHttpLoadBalancer(args: {
  readonly network: SyncNetwork;
  readonly balancerId: EndpointId;
  readonly nodes: readonly {
    readonly id: EndpointId;
    readonly handlers: HarnessHttpServerHandlers;
  }[];
  readonly faults?: EdgeFaultController;
  readonly onMutationsAccepted?: (clientNodeId: string) => void | Promise<void>;
}): () => void {
  if (args.nodes.length === 0) throw new Error('harness http: no server nodes');
  let nextNode = 0;
  args.network.register(args.balancerId, async (payload) => {
    if (!isHttpRequest(payload)) return;
    const node = args.nodes[nextNode % args.nodes.length]!;
    nextNode += 1;
    await dispatchHarnessHttpRequest({
      payload,
      serverId: node.id,
      network: args.network,
      handlers: node.handlers,
      ...(args.faults !== undefined ? { faults: args.faults } : {}),
      ...(args.onMutationsAccepted !== undefined
        ? { onMutationsAccepted: args.onMutationsAccepted }
        : {}),
    });
  });
  return () => args.network.unregister(args.balancerId);
}

export type HarnessHttpClient = {
  readonly postQueries: (
    requests: readonly QueryRequest[]
  ) => Promise<readonly QueryResponse[]>;
  readonly postMutations: (
    mutations: readonly MutationUploadRow[]
  ) => Promise<MutationUploadResult>;
  /** Reject in-flight RPCs without unregistering (disconnect / reconnect). */
  readonly abortPending: () => void;
  readonly dispose: () => void;
};

const DEFAULT_RPC_TIMEOUT_MS = 5_000;

function unwrapOk(
  res: HarnessHttpResponse,
  kind: 'query' | 'mutations'
): unknown {
  if (!res.ok) {
    if (res.message.startsWith('rate_limited:')) {
      const ms =
        res.retryAfterMs ?? Number(res.message.slice('rate_limited:'.length));
      throw new SyncHttpRateLimitError(ms);
    }
    if (res.message === 'auth:expired') {
      throw new SyncApiAuthError('expired');
    }
    throw new Error(res.message);
  }
  if (res.kind !== kind) throw new Error('harness http: unexpected response');
  return res.body;
}

/** Client-side HTTP over {@link SyncNetwork}. */
export function createHarnessHttpClient(args: {
  readonly network: SyncNetwork;
  readonly clientId: EndpointId;
  readonly serverId: EndpointId;
  readonly createId: () => string;
  readonly scheduler: VirtualScheduler;
  readonly rpcTimeoutMs?: number;
  /** Fired when a sync response is delivered to this client (before resolve). */
  readonly onSyncResponseDelivered?: () => void | Promise<void>;
}): HarnessHttpClient {
  const timeoutMs = args.rpcTimeoutMs ?? DEFAULT_RPC_TIMEOUT_MS;
  const pending: HarnessHttpPending = new Map();
  const nodeId = classifyEndpoint(args.clientId)?.nodeId;

  args.network.register(args.clientId, (payload) => {
    if (!isHttpResponse(payload)) return;
    const waiter = pending.get(payload.correlationId);
    if (waiter === undefined) return;
    pending.delete(payload.correlationId);
    const finish = () => waiter.resolve(payload);
    finish();
    if (args.onSyncResponseDelivered !== undefined && nodeId !== undefined) {
      // Resolve RPC before boundary crash hooks — crash dispose awaits
      // stopAndDrain on the same in-flight query sweep.
      void Promise.resolve(args.onSyncResponseDelivered());
    }
  });

  const rpc = createHarnessHttpRpc({
    network: args.network,
    clientId: args.clientId,
    serverId: args.serverId,
    scheduler: args.scheduler,
    timeoutMs,
    pending,
  });

  return {
    async postQueries(requests) {
      const res = await rpc({
        kind: 'query',
        correlationId: args.createId(),
        requests,
      });
      return validateWireQueryBatch(unwrapOk(res, 'query'), requests.length);
    },
    async postMutations(mutations) {
      const res = await rpc({
        kind: 'mutations',
        correlationId: args.createId(),
        mutations,
      });
      return unwrapOk(res, 'mutations') as MutationUploadResult;
    },
    abortPending: () => {
      abortAllPending(pending, 'harness http client disconnected');
    },
    dispose() {
      rejectAllPending(pending, 'harness http client disposed');
      args.network.unregister(args.clientId);
    },
  };
}
