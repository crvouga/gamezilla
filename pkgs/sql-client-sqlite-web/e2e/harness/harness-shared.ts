// @io-wall-ok — Bun WebView e2e harness helpers
import type { Timers } from '@pkgs/clock';
import {
  awaitRpcResponse,
  type BrokerToTabMessage,
  type ConnectResult,
  createRpcIdFactory,
  type DbChangedNotify,
  HEARTBEAT_INTERVAL_MS,
  type PendingRpc,
  type RpcRequest,
  type RpcResponse,
  settleRpcResponse,
} from '../../src/rpc';
import type { createMemoryOwnerRuntime } from './memory-owner-runtime';

export type MemoryOwner = ReturnType<typeof createMemoryOwnerRuntime>;

export type HarnessSession = {
  role: 'owner' | 'proxy' | null;
  owner: MemoryOwner;
  port: MessagePort | null;
  worker: SharedWorker | null;
  heartbeatTimer: unknown | null;
  unsubOwner: (() => void) | null;
};

export async function takeHarnessOwnership(
  session: HarnessSession,
  emitChanged: () => void
): Promise<void> {
  await session.owner.open();
  session.unsubOwner?.();
  session.unsubOwner = session.owner.onChanged(() => emitChanged());
  session.role = 'owner';
}

export async function dropHarnessOwnership(
  session: HarnessSession,
  recreate: () => MemoryOwner
): Promise<void> {
  session.unsubOwner?.();
  session.unsubOwner = null;
  await session.owner.close();
  session.owner = recreate();
  if (session.role === 'owner') session.role = 'proxy';
}

export async function handleHarnessPortMessage(
  message: BrokerToTabMessage,
  args: {
    readonly session: HarnessSession;
    readonly pending: Map<string, PendingRpc>;
    readonly timers: Timers;
    readonly dbName: string;
    readonly emitChanged: () => void;
    readonly takeOwnership: () => Promise<void>;
    readonly dropOwnership: () => Promise<void>;
  }
): Promise<void> {
  const { session } = args;
  if (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    message.type === 'db-changed'
  ) {
    args.emitChanged();
    return;
  }
  if (
    typeof message === 'object' &&
    message !== null &&
    'ok' in message &&
    typeof message.id === 'string'
  ) {
    settleRpcResponse(args.pending, message as RpcResponse, args.timers);
    return;
  }
  if (typeof message !== 'object' || message === null || !('op' in message)) {
    return;
  }
  const request = message as RpcRequest;
  if (request.op === 'becomeOwner') {
    await args.takeOwnership();
    session.port?.postMessage({ id: request.id, ok: true, result: null });
    return;
  }
  if (request.op === 'releaseOwner') {
    await args.dropOwnership();
    session.port?.postMessage({ id: request.id, ok: true, result: null });
    return;
  }
  if (session.role !== 'owner') return;
  const response = await session.owner.handleRequest(request);
  session.port?.postMessage(response);
  if (
    response.ok &&
    (request.op === 'run' ||
      request.op === 'stmtRun' ||
      request.op === 'commitTx')
  ) {
    session.port?.postMessage({
      type: 'db-changed',
      dbName: args.dbName,
    } satisfies DbChangedNotify);
  }
}

export async function connectHarnessSharedWorker(args: {
  readonly dbName: string;
  readonly timers: Timers;
  readonly session: HarnessSession;
  readonly pending: Map<string, PendingRpc>;
  readonly nextId: () => string;
  readonly emitChanged: () => void;
  readonly takeOwnership: () => Promise<void>;
  readonly dropOwnership: () => Promise<void>;
}): Promise<ConnectResult> {
  const worker = new SharedWorker('/sql-workers/db-host-shared-worker.js', {
    name: 'sql-db-host',
    type: 'module',
  });
  args.session.worker = worker;
  args.session.port = worker.port;
  args.session.port.onmessage = (event: MessageEvent<BrokerToTabMessage>) => {
    void handleHarnessPortMessage(event.data, args);
  };
  args.session.port.start();
  const id = args.nextId();
  const result = (await awaitRpcResponse({
    id,
    op: 'connect',
    pending: args.pending,
    timers: args.timers,
    send: () => {
      args.session.port?.postMessage({
        id,
        dbName: args.dbName,
        op: 'connect',
        payload: {},
      });
    },
  })) as ConnectResult;
  args.session.role = result.role;
  if (result.role === 'owner') await args.takeOwnership();
  const beat = () => {
    const hid = args.nextId();
    args.session.port?.postMessage({
      id: hid,
      dbName: args.dbName,
      op: 'heartbeat',
      payload: {},
    });
    args.session.heartbeatTimer = args.timers.setTimeout(
      beat,
      HEARTBEAT_INTERVAL_MS
    );
  };
  args.session.heartbeatTimer = args.timers.setTimeout(
    beat,
    HEARTBEAT_INTERVAL_MS
  );
  return result;
}

void createRpcIdFactory;
