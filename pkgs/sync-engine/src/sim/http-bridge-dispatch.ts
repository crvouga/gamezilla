import type { BoundaryFaultController } from './boundary-faults';
import type {
  SimHttpRequest,
  SimHttpResponse,
  SimHttpServerHandlers,
} from './http-bridge-types';
import type { SimEndpointId, SimNetwork } from './network';
import { classifyEndpoint } from './traffic';

function clientNodeFromReplyTo(replyTo: string): string | undefined {
  return classifyEndpoint(replyTo)?.nodeId;
}

function sendError(args: {
  readonly network: SimNetwork;
  readonly serverId: SimEndpointId;
  readonly replyTo: string;
  readonly correlationId: string;
  readonly message: string;
}): void {
  args.network.send(args.serverId, args.replyTo, {
    kind: 'error',
    correlationId: args.correlationId,
    ok: false,
    message: args.message,
  } satisfies SimHttpResponse);
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
  const body = await handlers.handleQuery(payload.requests);
  network.send(serverId, replyTo, {
    kind: 'query',
    correlationId: payload.correlationId,
    ok: true,
    body,
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
  if (clientNode !== undefined && failAfterCommit) {
    faults?.takeHttpFault(clientNode, 'failMutationsAfterCommit');
    throw new Error('sim http: fail after mutations commit');
  }

  network.send(serverId, replyTo, {
    kind: 'mutations',
    correlationId: payload.correlationId,
    ok: true,
    body,
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
