import type { BoundaryFaultController, SimHttpFault } from './boundary-faults';
import { corruptJsonString } from './corruption-faults';
import type {
  SimHttpRequest,
  SimHttpResponse,
  SimHttpServerHandlers,
} from './http-bridge-types';
import type { SimEndpointId, SimNetwork } from './network';
import { classifyEndpoint } from './traffic';

function httpFaultRoute(
  fault: SimHttpFault | undefined
): 'query' | 'mutations' | undefined {
  if (fault === undefined) return undefined;
  if ('route' in fault) return fault.route;
  return undefined;
}

function clientNodeFromReplyTo(replyTo: string): string | undefined {
  return classifyEndpoint(replyTo)?.nodeId;
}

function sendError(args: {
  readonly network: SimNetwork;
  readonly serverId: SimEndpointId;
  readonly replyTo: string;
  readonly correlationId: string;
  readonly message: string;
  readonly retryAfterMs?: number;
}): void {
  args.network.send(args.serverId, args.replyTo, {
    kind: 'error',
    correlationId: args.correlationId,
    ok: false,
    message: args.message,
    ...(args.retryAfterMs !== undefined
      ? { retryAfterMs: args.retryAfterMs }
      : {}),
  } satisfies SimHttpResponse);
}

function takeMatchingRouteFault(
  faults: BoundaryFaultController | undefined,
  clientNode: string | undefined,
  kind: SimHttpFault['kind'],
  route: 'mutations' | 'query'
): SimHttpFault | undefined {
  if (clientNode === undefined || faults === undefined) return undefined;
  const fault = faults.peekHttpFault(clientNode, kind);
  if (fault === undefined) return undefined;
  if ('route' in fault && fault.route !== route) return undefined;
  return faults.takeHttpFault(clientNode, kind);
}

function applyPreRouteFaults(args: {
  readonly route: 'mutations' | 'query';
  readonly payload: SimHttpRequest;
  readonly serverId: SimEndpointId;
  readonly network: SimNetwork;
  readonly faults?: BoundaryFaultController;
  readonly clientNode: string | undefined;
}): 'continue' | 'done' {
  const { route, payload, serverId, network, faults, clientNode } = args;
  const replyTo = payload.replyTo;
  const correlationId = payload.correlationId;

  const rateLimited = takeMatchingRouteFault(
    faults,
    clientNode,
    'rateLimited',
    route
  );
  if (rateLimited?.kind === 'rateLimited') {
    sendError({
      network,
      serverId,
      replyTo,
      correlationId,
      message: `rate_limited:${rateLimited.retryAfterMs}`,
      retryAfterMs: rateLimited.retryAfterMs,
    });
    return 'done';
  }

  const authExpired = takeMatchingRouteFault(
    faults,
    clientNode,
    'authExpiredInFlight',
    route
  );
  if (authExpired?.kind === 'authExpiredInFlight') {
    sendError({
      network,
      serverId,
      replyTo,
      correlationId,
      message: 'auth:expired',
    });
    return 'done';
  }

  if (
    route === 'mutations' &&
    clientNode !== undefined &&
    faults?.takeHttpFault(clientNode, 'batchTooLarge')
  ) {
    sendError({
      network,
      serverId,
      replyTo,
      correlationId,
      message: 'batch_too_large',
    });
    return 'done';
  }

  return 'continue';
}

async function dispatchQuery(args: {
  readonly payload: Extract<SimHttpRequest, { kind: 'query' }>;
  readonly serverId: SimEndpointId;
  readonly network: SimNetwork;
  readonly handlers: SimHttpServerHandlers;
  readonly faults?: BoundaryFaultController;
  readonly clientNode: string | undefined;
}): Promise<void> {
  const { payload, serverId, network, handlers, faults, clientNode } = args;
  const replyTo = payload.replyTo;
  if (
    applyPreRouteFaults({
      route: 'query',
      payload,
      serverId,
      network,
      clientNode,
      ...(faults !== undefined ? { faults } : {}),
    }) === 'done'
  ) {
    return;
  }
  const queryServerErr = clientNode
    ? faults?.peekHttpFault(clientNode, 'serverErrorOnNext')
    : undefined;
  if (
    queryServerErr?.kind === 'serverErrorOnNext' &&
    queryServerErr.route === 'query'
  ) {
    faults?.takeHttpFault(clientNode!, 'serverErrorOnNext');
    throw new Error('sim http: injected server error on query');
  }
  if (
    clientNode !== undefined &&
    faults?.takeHttpFault(clientNode, 'dropQueryResponse')
  ) {
    await handlers.handleQuery(payload.requests);
    return;
  }
  const abortBody =
    clientNode !== undefined &&
    httpFaultRoute(faults?.peekHttpFault(clientNode, 'abortResponseBody')) ===
      'query';
  const body = await handlers.handleQuery(payload.requests);
  if (abortBody && clientNode !== undefined) {
    faults?.takeHttpFault(clientNode, 'abortResponseBody');
    return;
  }
  const corrupt = clientNode
    ? faults?.peekHttpFault(clientNode, 'corruptQueryResponse')
    : undefined;
  let wireBody: unknown = body;
  if (corrupt?.kind === 'corruptQueryResponse') {
    faults?.takeHttpFault(clientNode!, 'corruptQueryResponse');
    wireBody = corruptJsonString(JSON.stringify(body), corrupt.variant);
  }
  network.send(serverId, replyTo, {
    kind: 'query',
    correlationId: payload.correlationId,
    ok: true,
    body: wireBody as typeof body,
  } satisfies SimHttpResponse);
}

async function dispatchMutations(args: {
  readonly payload: Extract<SimHttpRequest, { kind: 'mutations' }>;
  readonly serverId: SimEndpointId;
  readonly network: SimNetwork;
  readonly handlers: SimHttpServerHandlers;
  readonly faults?: BoundaryFaultController;
  readonly clientNode: string | undefined;
  readonly onMutationsAccepted?: (clientNodeId: string) => void | Promise<void>;
}): Promise<void> {
  const { payload, serverId, network, handlers, faults, clientNode } = args;
  const replyTo = payload.replyTo;
  if (
    applyPreRouteFaults({
      route: 'mutations',
      payload,
      serverId,
      network,
      clientNode,
      ...(faults !== undefined ? { faults } : {}),
    }) === 'done'
  ) {
    return;
  }
  const mutServerErr = clientNode
    ? faults?.peekHttpFault(clientNode, 'serverErrorOnNext')
    : undefined;
  if (
    mutServerErr?.kind === 'serverErrorOnNext' &&
    mutServerErr.route === 'mutations'
  ) {
    faults?.takeHttpFault(clientNode!, 'serverErrorOnNext');
    throw new Error('sim http: injected server error on mutations');
  }
  if (
    clientNode !== undefined &&
    faults?.takeHttpFault(clientNode, 'invalidMutationsBody')
  ) {
    sendError({
      network,
      serverId,
      replyTo,
      correlationId: payload.correlationId,
      message: 'invalid_batch',
    });
    return;
  }

  const insideTxn = clientNode
    ? faults?.peekHttpFault(clientNode, 'failMutationsInsideTxnAfter')
    : undefined;
  const dropResponse =
    clientNode !== undefined &&
    faults?.peekHttpFault(clientNode, 'dropMutationsResponse') !== undefined;
  const abortBody =
    clientNode !== undefined &&
    httpFaultRoute(faults?.peekHttpFault(clientNode, 'abortResponseBody')) ===
      'mutations';
  const failAfterCommit =
    clientNode !== undefined &&
    faults?.peekHttpFault(clientNode, 'failMutationsAfterCommit') !== undefined;

  const body = await handlers.handleMutations(payload.mutations, {
    ...(insideTxn?.kind === 'failMutationsInsideTxnAfter'
      ? {
          failInsideTxnAfter: insideTxn.after,
          onArmed: () => {
            faults?.takeHttpFault(clientNode!, 'failMutationsInsideTxnAfter');
          },
        }
      : {}),
  });

  if (clientNode !== undefined) {
    await args.onMutationsAccepted?.(clientNode);
  }
  if (clientNode !== undefined && dropResponse) {
    faults?.takeHttpFault(clientNode, 'dropMutationsResponse');
    return;
  }
  if (clientNode !== undefined && abortBody) {
    faults?.takeHttpFault(clientNode, 'abortResponseBody');
    return;
  }
  if (clientNode !== undefined && failAfterCommit) {
    faults?.takeHttpFault(clientNode, 'failMutationsAfterCommit');
    throw new Error('sim http: fail after mutations commit');
  }

  network.send(serverId, replyTo, {
    kind: 'mutations',
    correlationId: payload.correlationId,
    ok: true,
    body: (() => {
      const corrupt = clientNode
        ? faults?.peekHttpFault(clientNode, 'corruptMutationsResponse')
        : undefined;
      if (corrupt?.kind === 'corruptMutationsResponse') {
        faults?.takeHttpFault(clientNode!, 'corruptMutationsResponse');
        return corruptJsonString(
          JSON.stringify(body),
          corrupt.variant
        ) as unknown as typeof body;
      }
      return body;
    })(),
  } satisfies SimHttpResponse);
}

/** Dispatch one HTTP request with optional response-loss / error faults. */
export async function dispatchSimHttpRequest(args: {
  readonly payload: SimHttpRequest;
  readonly serverId: SimEndpointId;
  readonly network: SimNetwork;
  readonly handlers: SimHttpServerHandlers;
  readonly faults?: BoundaryFaultController;
  readonly onMutationsAccepted?: (clientNodeId: string) => void | Promise<void>;
}): Promise<void> {
  const { payload, serverId, network, handlers, faults } = args;
  const clientNode = clientNodeFromReplyTo(payload.replyTo);
  try {
    if (payload.kind === 'query') {
      await dispatchQuery({
        payload,
        serverId,
        network,
        handlers,
        clientNode,
        ...(faults !== undefined ? { faults } : {}),
      });
      return;
    }
    await dispatchMutations({
      payload,
      serverId,
      network,
      handlers,
      clientNode,
      ...(faults !== undefined ? { faults } : {}),
      ...(args.onMutationsAccepted !== undefined
        ? { onMutationsAccepted: args.onMutationsAccepted }
        : {}),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    sendError({
      network,
      serverId,
      replyTo: payload.replyTo,
      correlationId: payload.correlationId,
      message,
    });
  }
}
