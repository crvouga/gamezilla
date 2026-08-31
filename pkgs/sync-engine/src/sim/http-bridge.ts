import type {
  MutationUploadResult,
  MutationUploadRow,
} from '../client/mutation-upload-queue';
import type { QueryRequest } from '../client/subscription-runtime';
import { SyncApiAuthError } from '../client/sync-http-client';
import { SyncHttpRateLimitError } from '../client/sync-http-rate-limit-error';
import type { QueryResponse } from '../queries/core/types';
import type { BoundaryFaultController } from './boundary-faults';
import { dispatchSimHttpRequest } from './http-bridge-dispatch';
import {
  abortAllPending,
  createSimHttpRpc,
  rejectAllPending,
  type SimHttpPending,
} from './http-bridge-rpc';
import type {
  SimHttpRequest,
  SimHttpResponse,
  SimHttpServerHandlers,
} from './http-bridge-types';
import type { SimEndpointId, SimNetwork } from './network';
import type { SimScheduler } from './scheduler';
import { classifyEndpoint } from './traffic';

export type {
  SimHttpRequest,
  SimHttpRequestBody,
  SimHttpResponse,
  SimHttpServerHandlers,
} from './http-bridge-types';

function isHttpRequest(value: unknown): value is SimHttpRequest {
  if (value === null || typeof value !== 'object') return false;
  const r = value as Record<string, unknown>;
  return (
    typeof r['kind'] === 'string' &&
    typeof r['correlationId'] === 'string' &&
    typeof r['replyTo'] === 'string'
  );
}

function isHttpResponse(value: unknown): value is SimHttpResponse {
  if (value === null || typeof value !== 'object') return false;
  const r = value as Record<string, unknown>;
  return typeof r['correlationId'] === 'string' && 'ok' in r;
}

export function bindSimHttpServer(args: {
  readonly network: SimNetwork;
  readonly serverId: SimEndpointId;
  readonly handlers: SimHttpServerHandlers;
  readonly faults?: BoundaryFaultController;
  readonly onMutationsAccepted?: (clientNodeId: string) => void | Promise<void>;
}): () => void {
  args.network.register(args.serverId, async (payload) => {
    if (!isHttpRequest(payload)) return;
    await dispatchSimHttpRequest({
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

export type SimHttpClient = {
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

function unwrapOk(res: SimHttpResponse, kind: 'query' | 'mutations'): unknown {
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
  if (res.kind !== kind) throw new Error('sim http: unexpected response');
  return res.body;
}

/** Client-side HTTP over {@link SimNetwork}. */
export function createSimHttpClient(args: {
  readonly network: SimNetwork;
  readonly clientId: SimEndpointId;
  readonly serverId: SimEndpointId;
  readonly createId: () => string;
  readonly scheduler: SimScheduler;
  readonly rpcTimeoutMs?: number;
  /** Fired when a sync response is delivered to this client (before resolve). */
  readonly onSyncResponseDelivered?: () => void | Promise<void>;
}): SimHttpClient {
  const timeoutMs = args.rpcTimeoutMs ?? DEFAULT_RPC_TIMEOUT_MS;
  const pending: SimHttpPending = new Map();
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

  const rpc = createSimHttpRpc({
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
      return unwrapOk(res, 'query') as readonly QueryResponse[];
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
      abortAllPending(pending, 'sim http client disconnected');
    },
    dispose() {
      rejectAllPending(pending, 'sim http client disposed');
      args.network.unregister(args.clientId);
    },
  };
}
