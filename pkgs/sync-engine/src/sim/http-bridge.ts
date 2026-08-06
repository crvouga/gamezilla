import type {
  MutationUploadResult,
  MutationUploadRow,
} from '../client/mutation-upload-queue';
import type { QueryRequest } from '../client/subscription-fetch';
import type { QueryResponse } from '../queries/core/types';
import {
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

async function dispatchHttpRequest(args: {
  readonly payload: SimHttpRequest;
  readonly serverId: SimEndpointId;
  readonly network: SimNetwork;
  readonly handlers: SimHttpServerHandlers;
}): Promise<void> {
  const { payload, serverId, network, handlers } = args;
  const replyTo = payload.replyTo;
  try {
    if (payload.kind === 'query') {
      const body = await handlers.handleQuery(payload.request);
      network.send(serverId, replyTo, {
        kind: 'query',
        correlationId: payload.correlationId,
        ok: true,
        body,
      } satisfies SimHttpResponse);
      return;
    }
    if (payload.kind === 'queryBatch') {
      const body = await handlers.handleQueryBatch(payload.requests);
      network.send(serverId, replyTo, {
        kind: 'queryBatch',
        correlationId: payload.correlationId,
        ok: true,
        body,
      } satisfies SimHttpResponse);
      return;
    }
    const body = await handlers.handleMutations(payload.mutations);
    network.send(serverId, replyTo, {
      kind: 'mutations',
      correlationId: payload.correlationId,
      ok: true,
      body,
    } satisfies SimHttpResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    network.send(serverId, replyTo, {
      kind: 'error',
      correlationId: payload.correlationId,
      ok: false,
      message,
    } satisfies SimHttpResponse);
  }
}

export function bindSimHttpServer(args: {
  readonly network: SimNetwork;
  readonly serverId: SimEndpointId;
  readonly handlers: SimHttpServerHandlers;
}): () => void {
  args.network.register(args.serverId, async (payload) => {
    if (!isHttpRequest(payload)) return;
    await dispatchHttpRequest({
      payload,
      serverId: args.serverId,
      network: args.network,
      handlers: args.handlers,
    });
  });

  return () => args.network.unregister(args.serverId);
}

export type SimHttpClient = {
  readonly postQuery: (request: QueryRequest) => Promise<QueryResponse>;
  readonly postQueryBatch: (
    requests: readonly QueryRequest[]
  ) => Promise<readonly QueryResponse[]>;
  readonly postMutations: (
    mutations: readonly MutationUploadRow[]
  ) => Promise<MutationUploadResult>;
  readonly dispose: () => void;
};

const DEFAULT_RPC_TIMEOUT_MS = 5_000;

function unwrapOk(
  res: SimHttpResponse,
  kind: 'query' | 'queryBatch' | 'mutations'
): unknown {
  if (!res.ok) throw new Error(res.message);
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
}): SimHttpClient {
  const timeoutMs = args.rpcTimeoutMs ?? DEFAULT_RPC_TIMEOUT_MS;
  const pending: SimHttpPending = new Map();

  args.network.register(args.clientId, (payload) => {
    if (!isHttpResponse(payload)) return;
    const waiter = pending.get(payload.correlationId);
    if (waiter === undefined) return;
    pending.delete(payload.correlationId);
    waiter.resolve(payload);
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
    async postQuery(request) {
      const res = await rpc({
        kind: 'query',
        correlationId: args.createId(),
        request,
      });
      return unwrapOk(res, 'query') as QueryResponse;
    },
    async postQueryBatch(requests) {
      const res = await rpc({
        kind: 'queryBatch',
        correlationId: args.createId(),
        requests,
      });
      return unwrapOk(res, 'queryBatch') as readonly QueryResponse[];
    },
    async postMutations(mutations) {
      const res = await rpc({
        kind: 'mutations',
        correlationId: args.createId(),
        mutations,
      });
      return unwrapOk(res, 'mutations') as MutationUploadResult;
    },
    dispose() {
      rejectAllPending(pending, 'sim http client disposed');
      args.network.unregister(args.clientId);
    },
  };
}
