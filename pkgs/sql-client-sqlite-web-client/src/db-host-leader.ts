import type { Timers } from '@pkgs/clock-shared/types';
import type {
  OwnerRuntime,
  TransportOwnerRuntimeFactory,
} from '@pkgs/sql-client-sqlite-web-shared/owner-runtime';
import { awaitRpcResponse, createRpcIdFactory, HEARTBEAT_INTERVAL_MS, isLeaderLostError, leaderLostError, settleRpcResponse } from '@pkgs/sql-client-sqlite-web-shared/rpc';
import type { BrokerToTabMessage, ConnectResult, DbChangedNotify, PendingRpc, RpcOp, RpcRequest, RpcResponse } from '@pkgs/sql-client-sqlite-web-shared/rpc';

export type LeaderTransport = {
  connect: () => Promise<ConnectResult>;
  disconnect: () => Promise<void>;
  /** The page is going away: free the store and the owner lock now. */
  leaveOnUnload: () => void;
  request: <O extends RpcOp>(
    op: O,
    payload: RpcRequest<O>['payload'],
    opts?: { timeoutMs?: number }
  ) => Promise<
    RpcResponse<O> extends { ok: true; result: infer R } ? R : never
  >;
  onChanged: (listener: (notify: DbChangedNotify) => void) => () => void;
  isOwner: () => boolean;
  getOwnerRuntime: () => OwnerRuntime | null;
};

class LeaderTransportImpl implements LeaderTransport {
  private readonly dbName: string;
  private readonly timers: Timers;
  private readonly tabId: string;
  private readonly createFn: TransportOwnerRuntimeFactory;
  private readonly nextId: () => string;
  private readonly pending = new Map<string, PendingRpc>();
  private readonly changeListeners = new Set<
    (notify: DbChangedNotify) => void
  >();
  private role: 'owner' | 'proxy' | null = null;
  private ownerRuntime: OwnerRuntime | null = null;
  private rpcChannel: BroadcastChannel | null = null;
  private changedChannel: BroadcastChannel | null = null;
  private releaseLock: (() => void) | null = null;
  private heartbeatTimer: unknown | null = null;
  private unsubOwnerChanged: (() => void) | null = null;
  private connected = false;

  constructor(args: {
    readonly dbName: string;
    readonly timers: Timers;
    readonly tabId: string;
    readonly createOwnerRuntime: TransportOwnerRuntimeFactory;
  }) {
    this.dbName = args.dbName;
    this.timers = args.timers;
    this.tabId = args.tabId;
    this.createFn = args.createOwnerRuntime;
    this.nextId = createRpcIdFactory(`lead_${args.tabId}`);
  }

  private async tryAcquireOwnership(): Promise<'owner' | 'proxy'> {
    const locks = navigator.locks;
    if (locks === undefined) return 'owner';
    return new Promise<'owner' | 'proxy'>((resolve) => {
      void locks.request(
        `db-owner:${this.dbName}`,
        { mode: 'exclusive', ifAvailable: true },
        (lock) => {
          if (lock === null) {
            resolve('proxy');
            return;
          }
          resolve('owner');
          return new Promise<void>((release) => {
            this.releaseLock = release;
          });
        }
      );
    });
  }

  private async becomeOwner(): Promise<void> {
    this.ownerRuntime = this.createFn({
      dbName: this.dbName,
      timers: this.timers,
    });
    await this.ownerRuntime.open();
    this.unsubOwnerChanged = this.ownerRuntime.onChanged((notify) => {
      this.changedChannel?.postMessage(notify);
      for (const listener of this.changeListeners) listener(notify);
    });
    this.role = 'owner';
  }

  private async teardownOwner(): Promise<void> {
    this.unsubOwnerChanged?.();
    this.unsubOwnerChanged = null;
    if (this.ownerRuntime !== null) {
      await this.ownerRuntime.close();
      this.ownerRuntime = null;
    }
    if (this.releaseLock !== null) {
      this.releaseLock();
      this.releaseLock = null;
    }
    this.role = null;
  }

  private async onRpcMessage(message: BrokerToTabMessage): Promise<void> {
    if (
      typeof message === 'object' &&
      message !== null &&
      'ok' in message &&
      typeof (message as RpcResponse).id === 'string'
    ) {
      settleRpcResponse(this.pending, message as RpcResponse, this.timers);
      return;
    }
    if (
      typeof message !== 'object' ||
      message === null ||
      !('op' in message) ||
      typeof (message as RpcRequest).id !== 'string'
    ) {
      return;
    }
    const request = message as RpcRequest;
    if (this.role !== 'owner' || this.ownerRuntime === null) return;
    if (request.from === this.tabId) return;
    if (request.dbName !== this.dbName) return;
    const response = await this.ownerRuntime.handleRequest(request);
    this.rpcChannel?.postMessage({ ...response, from: this.tabId });
  }

  private ensureChannels(): void {
    if (this.rpcChannel === null) {
      this.rpcChannel = new BroadcastChannel(`db-rpc:${this.dbName}`);
      this.rpcChannel.onmessage = (event) => {
        void this.onRpcMessage(event.data);
      };
    }
    if (this.changedChannel === null) {
      this.changedChannel = new BroadcastChannel(`db-changed:${this.dbName}`);
      this.changedChannel.onmessage = (event) => {
        for (const listener of this.changeListeners) listener(event.data);
      };
    }
  }

  async connect(): Promise<ConnectResult> {
    if (this.connected && this.role !== null) return { role: this.role };
    this.ensureChannels();
    const acquired = await this.tryAcquireOwnership();
    if (acquired === 'owner') await this.becomeOwner();
    else this.role = 'proxy';
    this.connected = true;
    const beat = () => {
      this.heartbeatTimer = this.timers.setTimeout(beat, HEARTBEAT_INTERVAL_MS);
    };
    this.heartbeatTimer = this.timers.setTimeout(beat, HEARTBEAT_INTERVAL_MS);
    return { role: this.role ?? 'proxy' };
  }

  async disconnect(): Promise<void> {
    if (!this.connected) return;
    this.connected = false;
    if (this.heartbeatTimer !== null) {
      this.timers.clearTimeout(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    await this.teardownOwner();
    this.rpcChannel?.close();
    this.rpcChannel = null;
    this.changedChannel?.close();
    this.changedChannel = null;
    for (const [, entry] of this.pending) {
      this.timers.clearTimeout(entry.timerId);
      entry.reject(leaderLostError('Disconnected'));
    }
    this.pending.clear();
  }

  private async requestOnce(
    op: RpcOp,
    payload: RpcRequest['payload'],
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
        this.rpcChannel?.postMessage({
          id,
          dbName: this.dbName,
          op,
          payload,
          from: this.tabId,
        } as RpcRequest);
      },
    });
  }

  async request<O extends RpcOp>(
    op: O,
    payload: RpcRequest<O>['payload'],
    opts?: { timeoutMs?: number }
  ): Promise<RpcResponse<O> extends { ok: true; result: infer R } ? R : never> {
    try {
      return (await this.requestOnce(op, payload, opts)) as never;
    } catch (error: unknown) {
      if (
        !isLeaderLostError(error) &&
        !(error instanceof Error && error.name === 'RpcTimeoutError')
      ) {
        throw error;
      }
      await this.teardownOwner();
      const next = await this.tryAcquireOwnership();
      if (next === 'owner') await this.becomeOwner();
      else this.role = 'proxy';
      return (await this.requestOnce(op, payload, opts)) as never;
    }
  }

  onChanged(listener: (notify: DbChangedNotify) => void): () => void {
    this.changeListeners.add(listener);
    return () => {
      this.changeListeners.delete(listener);
    };
  }

  leaveOnUnload(): void {
    this.unsubOwnerChanged?.();
    this.unsubOwnerChanged = null;
    this.ownerRuntime?.release();
    this.ownerRuntime = null;
    this.releaseLock?.();
    this.releaseLock = null;
    this.role = null;
  }

  isOwner(): boolean {
    return this.role === 'owner';
  }

  getOwnerRuntime(): OwnerRuntime | null {
    return this.ownerRuntime;
  }
}

/**
 * Web Lock + BroadcastChannel leader election when SharedWorker is unavailable.
 */
export function createLeaderTransport(args: {
  readonly dbName: string;
  readonly timers: Timers;
  readonly tabId: string;
  readonly createOwnerRuntime: TransportOwnerRuntimeFactory;
}): LeaderTransport {
  return new LeaderTransportImpl({
    dbName: args.dbName,
    timers: args.timers,
    tabId: args.tabId,
    createOwnerRuntime: args.createOwnerRuntime,
  });
}
