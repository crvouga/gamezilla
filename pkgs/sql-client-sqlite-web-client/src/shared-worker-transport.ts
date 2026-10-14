import type { Timers } from '@pkgs/clock-shared/types';
import { OPEN_DATABASE_TIMEOUT_MS } from '@pkgs/sql-client-sqlite-web-shared/open-retry';
import type {
  BrokerToTabMessage,
  ConnectResult,
  DbChangedNotify,
  PendingRpc,
  RpcOp,
  RpcRequest,
  RpcResponse,
} from '@pkgs/sql-client-sqlite-web-shared/rpc';
import {
  awaitRpcResponse,
  createRpcIdFactory,
  HEARTBEAT_INTERVAL_MS,
  settleRpcResponse,
} from '@pkgs/sql-client-sqlite-web-shared/rpc';
import {
  SQL_DB_HOST_PROTOCOL_VERSION,
  sqlDbHostSharedWorkerName,
} from '@pkgs/sql-client-sqlite-web-shared/sql-db-host-protocol';
import { workerScriptLoadError } from '@pkgs/sql-client-sqlite-web-shared/worker-script-load-error';
import type {
  OwnerRuntime,
  TransportOwnerRuntimeFactory,
} from './owner-runtime';

export type WebSqlTransport = {
  connect: () => Promise<ConnectResult>;
  disconnect: () => Promise<void>;
  /**
   * The page is being discarded or frozen: free the store's handles and tell
   * the broker synchronously, because the async
   * {@link WebSqlTransport.disconnect} never finishes in time.
   */
  leaveOnUnload: () => void;
  request: <O extends RpcOp>(
    op: O,
    payload: RpcRequest<O>['payload'],
    opts?: { timeoutMs?: number }
  ) => Promise<unknown>;
  onChanged: (listener: (notify: DbChangedNotify) => void) => () => void;
  isOwner: () => boolean;
  getOwnerRuntime: () => OwnerRuntime | null;
};

class SharedWorkerTransport implements WebSqlTransport {
  private readonly dbName: string;
  private readonly timers: Timers;
  private readonly workerUrl: string;
  private readonly protocolVersion: number;
  private readonly createOwnerRuntimeFn: TransportOwnerRuntimeFactory;
  private readonly nextId = createRpcIdFactory('sw');
  private readonly pending = new Map<string, PendingRpc>();
  private readonly changeListeners = new Set<
    (notify: DbChangedNotify) => void
  >();
  private worker: SharedWorker | null = null;
  private port: MessagePort | null = null;
  private role: 'owner' | 'proxy' | null = null;
  private ownerRuntime: OwnerRuntime | null = null;
  private unsubOwnerChanged: (() => void) | null = null;
  private heartbeatTimer: unknown | null = null;
  private connected = false;

  constructor(args: {
    readonly dbName: string;
    readonly timers: Timers;
    readonly workerUrl: string;
    readonly createOwnerRuntimeFn: TransportOwnerRuntimeFactory;
    readonly protocolVersion?: number;
  }) {
    this.dbName = args.dbName;
    this.timers = args.timers;
    this.workerUrl = args.workerUrl;
    this.createOwnerRuntimeFn = args.createOwnerRuntimeFn;
    this.protocolVersion = args.protocolVersion ?? SQL_DB_HOST_PROTOCOL_VERSION;
  }

  private post(message: BrokerToTabMessage): void {
    this.port?.postMessage(message);
  }

  private async takeOwnership(): Promise<void> {
    if (this.ownerRuntime !== null) {
      this.role = 'owner';
      // Prior attempt may have left a closed/failed runtime — ensure open.
      await this.ownerRuntime.open();
      return;
    }
    this.ownerRuntime = this.createOwnerRuntimeFn({
      dbName: this.dbName,
      timers: this.timers,
    });
    try {
      await this.ownerRuntime.open();
      this.unsubOwnerChanged = this.ownerRuntime.onChanged((notify) => {
        this.post(notify);
        for (const listener of this.changeListeners) listener(notify);
      });
      this.role = 'owner';
    } catch (error: unknown) {
      await this.dropOwnership();
      throw error;
    }
  }

  private async dropOwnership(): Promise<void> {
    this.unsubOwnerChanged?.();
    this.unsubOwnerChanged = null;
    if (this.ownerRuntime !== null) {
      await this.ownerRuntime.close();
      this.ownerRuntime = null;
    }
    if (this.role === 'owner') this.role = 'proxy';
  }

  private async onMessage(message: BrokerToTabMessage): Promise<void> {
    if (
      typeof message === 'object' &&
      message !== null &&
      'type' in message &&
      message.type === 'db-changed'
    ) {
      for (const listener of this.changeListeners) listener(message);
      return;
    }
    if (
      typeof message === 'object' &&
      message !== null &&
      'ok' in message &&
      typeof message.id === 'string'
    ) {
      settleRpcResponse(this.pending, message as RpcResponse, this.timers);
      return;
    }
    await this.onRpcRequest(message);
  }

  private async onRpcRequest(message: BrokerToTabMessage): Promise<void> {
    if (
      typeof message !== 'object' ||
      message === null ||
      !('op' in message) ||
      typeof (message as RpcRequest).id !== 'string'
    ) {
      return;
    }
    const request = message as RpcRequest;
    if (request.dbName !== this.dbName) return;
    if (request.op === 'becomeOwner') {
      await this.takeOwnership();
      this.post({ id: request.id, ok: true, result: null });
      return;
    }
    if (request.op === 'releaseOwner') {
      await this.dropOwnership();
      this.post({ id: request.id, ok: true, result: null });
      return;
    }
    if (this.role !== 'owner' || this.ownerRuntime === null) return;
    this.post(await this.ownerRuntime.handleRequest(request));
  }

  private rejectAllPending(error: Error): void {
    for (const [, entry] of this.pending) {
      this.timers.clearTimeout(entry.timerId);
      entry.reject(error);
    }
    this.pending.clear();
  }

  async connect(): Promise<ConnectResult> {
    if (this.connected && this.role !== null) return { role: this.role };
    this.worker = new SharedWorker(this.workerUrl, {
      name: sqlDbHostSharedWorkerName(this.protocolVersion),
      type: 'module',
    });
    this.worker.onerror = (event) => {
      this.rejectAllPending(workerScriptLoadError(event));
    };
    this.port = this.worker.port;
    this.port.onmessage = (event: MessageEvent<BrokerToTabMessage>) => {
      void this.onMessage(event.data);
    };
    this.port.start();
    const id = this.nextId();
    const result = (await awaitRpcResponse({
      id,
      op: 'connect',
      pending: this.pending,
      timers: this.timers,
      timeoutMs: OPEN_DATABASE_TIMEOUT_MS,
      send: () => {
        this.post({ id, dbName: this.dbName, op: 'connect', payload: {} });
      },
    })) as ConnectResult;
    this.role = result.role;
    if (result.role === 'owner') await this.takeOwnership();
    this.connected = true;
    const beat = () => {
      const hid = this.nextId();
      this.post({
        id: hid,
        dbName: this.dbName,
        op: 'heartbeat',
        payload: {},
      });
      this.heartbeatTimer = this.timers.setTimeout(beat, HEARTBEAT_INTERVAL_MS);
    };
    this.heartbeatTimer = this.timers.setTimeout(beat, HEARTBEAT_INTERVAL_MS);
    return result;
  }

  async disconnect(): Promise<void> {
    if (!this.connected) return;
    this.connected = false;
    if (this.heartbeatTimer !== null) {
      this.timers.clearTimeout(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    // Close OPFS before telling the broker — otherwise promoteOwner races the
    // next tab's open against our still-live AccessHandlePoolVFS ("Invalid VFS state").
    await this.dropOwnership();
    try {
      const id = this.nextId();
      await awaitRpcResponse({
        id,
        op: 'disconnect',
        pending: this.pending,
        timers: this.timers,
        timeoutMs: 5_000,
        send: () => {
          this.post({
            id,
            dbName: this.dbName,
            op: 'disconnect',
            payload: {},
          });
        },
      });
    } catch {
      // best-effort
    }
    this.port?.close();
    this.port = null;
    if (this.worker !== null) {
      this.worker.onerror = null;
    }
    this.worker = null;
    this.role = null;
  }

  leaveOnUnload(): void {
    // Ownership starts before open() settles. Navigation during that open
    // must release the worker and broker slot as well.
    if (this.port === null) return;
    this.unsubOwnerChanged?.();
    this.unsubOwnerChanged = null;
    this.ownerRuntime?.release();
    this.ownerRuntime = null;
    if (this.role === 'owner') this.role = 'proxy';
    this.post({
      id: this.nextId(),
      dbName: this.dbName,
      op: 'disconnect',
      payload: {},
    });
  }

  async request<O extends RpcOp>(
    op: O,
    payload: RpcRequest<O>['payload'],
    opts?: { timeoutMs?: number }
  ): Promise<unknown> {
    if (this.role === 'owner' && this.ownerRuntime !== null) {
      const response = await this.ownerRuntime.handleRequest({
        id: this.nextId(),
        dbName: this.dbName,
        op,
        payload,
      } as RpcRequest);
      if (!response.ok) {
        throw Object.assign(new Error(response.error.message), {
          name: response.error.name,
          code: response.error.code,
          stack: response.error.stack,
        });
      }
      return response.result;
    }
    const id = this.nextId();
    return awaitRpcResponse({
      id,
      op,
      pending: this.pending,
      timers: this.timers,
      ...(opts?.timeoutMs !== undefined ? { timeoutMs: opts.timeoutMs } : {}),
      send: () => {
        this.post({
          id,
          dbName: this.dbName,
          op,
          payload,
        } as RpcRequest);
      },
    });
  }

  onChanged(listener: (notify: DbChangedNotify) => void): () => void {
    this.changeListeners.add(listener);
    return () => {
      this.changeListeners.delete(listener);
    };
  }

  isOwner(): boolean {
    return this.role === 'owner';
  }

  getOwnerRuntime(): OwnerRuntime | null {
    return this.ownerRuntime;
  }
}

export function createSharedWorkerTransport(args: {
  readonly dbName: string;
  readonly timers: Timers;
  readonly workerUrl: string;
  readonly createOwnerRuntimeFn: TransportOwnerRuntimeFactory;
  readonly protocolVersion?: number;
}): WebSqlTransport {
  return new SharedWorkerTransport(args);
}
