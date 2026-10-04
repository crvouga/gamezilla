import { corruptJsonString } from './corruption-faults';
import type { EdgeFaultController, HarnessHttpFault } from './edge-faults';
import type {
  HarnessHttpRequest,
  HarnessHttpResponse,
  HarnessHttpServerHandlers,
} from './http-bridge-types';
import type { EndpointId } from '@pkgs/harness-shared/network-state';
import type { SyncNetwork } from './network';
import { classifyEndpoint } from './traffic';

function httpFaultRoute(
  fault: HarnessHttpFault | undefined
): 'query' | 'mutations' | undefined {
  if (fault === undefined) return undefined;
  if ('route' in fault) return fault.route;
  return undefined;
}

function clientNodeFromReplyTo(replyTo: string): string | undefined {
  return classifyEndpoint(replyTo)?.nodeId;
}

function sendError(args: {
  readonly network: SyncNetwork;
  readonly serverId: EndpointId;
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
  } satisfies HarnessHttpResponse);
}

function takeMatchingRouteFault(
  faults: EdgeFaultController | undefined,
  clientNode: string | undefined,
  kind: HarnessHttpFault['kind'],
  route: 'mutations' | 'query'
): HarnessHttpFault | undefined {
  if (clientNode === undefined || faults === undefined) return undefined;
  const fault = faults.peekHttpFault(clientNode, kind);
  if (fault === undefined) return undefined;
  if ('route' in fault && fault.route !== route) return undefined;
  return faults.takeHttpFault(clientNode, kind);
}

function applyPreRouteFaults(args: {
  readonly route: 'mutations' | 'query';
  readonly payload: HarnessHttpRequest;
  readonly serverId: EndpointId;
  readonly network: SyncNetwork;
  readonly faults?: EdgeFaultController;
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
  readonly payload: Extract<HarnessHttpRequest, { kind: 'query' }>;
  readonly serverId: EndpointId;
  readonly network: SyncNetwork;
  readonly handlers: HarnessHttpServerHandlers;
  readonly faults?: EdgeFaultController;
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
    throw new Error('harness http: injected server error on query');
  }
  if (
    clientNode !== undefined &&
    faults?.takeHttpFault(clientNode, 'dropQueryResponse')
  ) {
    await handlers.handleQuery(payload.requests, clientNode);
    return;
  }
  const abortBody =
    clientNode !== undefined &&
    httpFaultRoute(faults?.peekHttpFault(clientNode, 'abortResponseBody')) ===
      'query';
  const body = await handlers.handleQuery(payload.requests, clientNode);
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
  } satisfies HarnessHttpResponse);
}

function applyMutationsPreHandlerFaults(args: {
  readonly payload: Extract<HarnessHttpRequest, { kind: 'mutations' }>;
  readonly serverId: EndpointId;
  readonly network: SyncNetwork;
  readonly faults?: EdgeFaultController;
  readonly clientNode: string | undefined;
}): 'continue' | 'done' {
  const { payload, serverId, network, faults, clientNode } = args;
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
    return 'done';
  }
  const mutServerErr = clientNode
    ? faults?.peekHttpFault(clientNode, 'serverErrorOnNext')
    : undefined;
  if (
    mutServerErr?.kind === 'serverErrorOnNext' &&
    mutServerErr.route === 'mutations'
  ) {
    faults?.takeHttpFault(clientNode!, 'serverErrorOnNext');
    throw new Error('harness http: injected server error on mutations');
  }
  if (
    clientNode !== undefined &&
    faults?.takeHttpFault(clientNode, 'invalidMutationsBody')
  ) {
    sendError({
      network,
      serverId,
      replyTo: payload.replyTo,
      correlationId: payload.correlationId,
      message: 'invalid_batch',
    });
    return 'done';
  }
  return 'continue';
}

type MutationsResponseFaults = {
  readonly insideTxn:
    | Extract<HarnessHttpFault, { kind: 'failMutationsInsideTxnAfter' }>
    | undefined;
  readonly dropResponse: boolean;
  readonly abortBody: boolean;
  readonly failAfterCommit: boolean;
};

function peekMutationsResponseFaults(
  faults: EdgeFaultController | undefined,
  clientNode: string | undefined
): MutationsResponseFaults {
  if (clientNode === undefined) {
    return {
      insideTxn: undefined,
      dropResponse: false,
      abortBody: false,
      failAfterCommit: false,
    };
  }
  const insideTxn = faults?.peekHttpFault(
    clientNode,
    'failMutationsInsideTxnAfter'
  );
  return {
    insideTxn:
      insideTxn?.kind === 'failMutationsInsideTxnAfter' ? insideTxn : undefined,
    dropResponse:
      faults?.peekHttpFault(clientNode, 'dropMutationsResponse') !== undefined,
    abortBody:
      httpFaultRoute(faults?.peekHttpFault(clientNode, 'abortResponseBody')) ===
      'mutations',
    failAfterCommit:
      faults?.peekHttpFault(clientNode, 'failMutationsAfterCommit') !==
      undefined,
  };
}

function wireMutationsBody(
  body: Awaited<ReturnType<HarnessHttpServerHandlers['handleMutations']>>,
  faults: EdgeFaultController | undefined,
  clientNode: string | undefined
): typeof body {
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
}

async function dispatchMutations(args: {
  readonly payload: Extract<HarnessHttpRequest, { kind: 'mutations' }>;
  readonly serverId: EndpointId;
  readonly network: SyncNetwork;
  readonly handlers: HarnessHttpServerHandlers;
  readonly faults?: EdgeFaultController;
  readonly clientNode: string | undefined;
  readonly onMutationsAccepted?: (clientNodeId: string) => void | Promise<void>;
}): Promise<void> {
  const { payload, serverId, network, handlers, faults, clientNode } = args;
  if (
    applyMutationsPreHandlerFaults({
      payload,
      serverId,
      network,
      clientNode,
      ...(faults !== undefined ? { faults } : {}),
    }) === 'done'
  ) {
    return;
  }

  const responseFaults = peekMutationsResponseFaults(faults, clientNode);
  const body = await handlers.handleMutations(payload.mutations, {
    ...(responseFaults.insideTxn !== undefined
      ? {
          failInsideTxnAfter: responseFaults.insideTxn.after,
          onArmed: () => {
            faults?.takeHttpFault(clientNode!, 'failMutationsInsideTxnAfter');
          },
        }
      : {}),
  });

  if (clientNode !== undefined) {
    await args.onMutationsAccepted?.(clientNode);
  }
  if (clientNode !== undefined && responseFaults.dropResponse) {
    faults?.takeHttpFault(clientNode, 'dropMutationsResponse');
    return;
  }
  if (clientNode !== undefined && responseFaults.abortBody) {
    faults?.takeHttpFault(clientNode, 'abortResponseBody');
    return;
  }
  if (clientNode !== undefined && responseFaults.failAfterCommit) {
    faults?.takeHttpFault(clientNode, 'failMutationsAfterCommit');
    throw new Error('harness http: fail after mutations commit');
  }

  network.send(serverId, payload.replyTo, {
    kind: 'mutations',
    correlationId: payload.correlationId,
    ok: true,
    body: wireMutationsBody(body, faults, clientNode),
  } satisfies HarnessHttpResponse);
}

/** Dispatch one HTTP request with optional response-loss / error faults. */
export async function dispatchHarnessHttpRequest(args: {
  readonly payload: HarnessHttpRequest;
  readonly serverId: EndpointId;
  readonly network: SyncNetwork;
  readonly handlers: HarnessHttpServerHandlers;
  readonly faults?: EdgeFaultController;
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
