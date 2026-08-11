// @io-wall-ok — Playwright harness: wall timers + self-contained multi-tab client

import type { Timers } from '@pkgs/clock';
import { wallTimers } from '@pkgs/clock';
import { Sql, type Value } from '@pkgs/sql';
import {
  awaitRpcResponse,
  createRpcIdFactory,
  type DbChangedNotify,
  type PendingRpc,
  type RpcRequest,
  serializeSql,
  settleRpcResponse,
} from '../../src/sqlite/web/rpc';
import {
  connectHarnessSharedWorker,
  dropHarnessOwnership,
  type HarnessSession,
  takeHarnessOwnership,
} from './harness-shared';
import { createMemoryOwnerRuntime } from './memory-owner-runtime';

export type HarnessClient = {
  connect: () => Promise<{ role: string }>;
  disconnect: () => Promise<void>;
  run: (statement: string, values?: Value[]) => Promise<unknown>;
  query: (statement: string, values?: Value[]) => Promise<unknown>;
  beginAbandonedTx: () => Promise<void>;
  isOwner: () => boolean;
  onChanged: (fn: () => void) => void;
};

function makeSql(
  statement: string,
  values: Value[]
): Sql<Record<string, unknown>> {
  return new Sql(statement.split('?'), values);
}

class HarnessClientImpl implements HarnessClient {
  private readonly dbName: string;
  private readonly forceLeader: boolean;
  private readonly timers: Timers;
  private readonly nextId: () => string;
  private readonly pending = new Map<string, PendingRpc>();
  private readonly changeListeners = new Set<() => void>();
  private readonly session: HarnessSession;
  private readonly tabId: string;
  private rpcChannel: BroadcastChannel | null = null;
  private releaseLock: (() => void) | null = null;

  constructor(args: {
    readonly dbName: string;
    readonly forceLeader: boolean;
    readonly timers: Timers;
  }) {
    this.dbName = args.dbName;
    this.forceLeader = args.forceLeader;
    this.timers = args.timers;
    this.nextId = createRpcIdFactory('h');
    this.tabId = this.nextId();
    this.session = {
      role: null,
      owner: createMemoryOwnerRuntime({
        dbName: args.dbName,
        timers: args.timers,
      }),
      port: null,
      worker: null,
      heartbeatTimer: null,
      unsubOwner: null,
    };
  }

  private emitChanged(): void {
    for (const listener of this.changeListeners) listener();
  }

  private takeOwnership = () =>
    takeHarnessOwnership(this.session, () => this.emitChanged());

  private dropOwnership = () =>
    dropHarnessOwnership(this.session, () =>
      createMemoryOwnerRuntime({
        dbName: this.dbName,
        timers: this.timers,
      })
    );

  async connect(): Promise<{ role: string }> {
    if (this.forceLeader || typeof SharedWorker === 'undefined') {
      return this.connectLeader();
    }
    try {
      return await connectHarnessSharedWorker({
        dbName: this.dbName,
        timers: this.timers,
        session: this.session,
        pending: this.pending,
        nextId: this.nextId,
        emitChanged: () => this.emitChanged(),
        takeOwnership: this.takeOwnership,
        dropOwnership: this.dropOwnership,
      });
    } catch {
      return this.connectLeader();
    }
  }

  private async connectLeader(): Promise<{ role: string }> {
    this.rpcChannel = new BroadcastChannel(`db-rpc:${this.dbName}`);
    this.rpcChannel.onmessage = (event) => {
      void this.onLeaderMessage(event.data);
    };
    new BroadcastChannel(`db-changed:${this.dbName}`).onmessage = () => {
      this.emitChanged();
    };
    const acquired = await this.tryLock();
    if (acquired) {
      await this.takeOwnership();
      return { role: 'owner' };
    }
    this.session.role = 'proxy';
    return { role: 'proxy' };
  }

  private async tryLock(): Promise<boolean> {
    const locks = navigator.locks;
    if (locks === undefined) return true;
    return new Promise<boolean>((resolve) => {
      void locks.request(
        `db-owner:${this.dbName}`,
        { mode: 'exclusive', ifAvailable: true },
        (lock) => {
          if (lock === null) {
            resolve(false);
            return;
          }
          resolve(true);
          return new Promise<void>((release) => {
            this.releaseLock = release;
          });
        }
      );
    });
  }

  private async onLeaderMessage(message: unknown): Promise<void> {
    if (typeof message === 'object' && message !== null && 'ok' in message) {
      settleRpcResponse(this.pending, message as never, this.timers);
      return;
    }
    if (typeof message !== 'object' || message === null || !('op' in message)) {
      return;
    }
    const requestMsg = message as RpcRequest;
    if (this.session.role !== 'owner' || requestMsg.from === this.tabId) {
      return;
    }
    const response = await this.session.owner.handleRequest(requestMsg);
    this.rpcChannel?.postMessage({ ...response, from: this.tabId });
    if (
      response.ok &&
      (requestMsg.op === 'run' || requestMsg.op === 'commitTx')
    ) {
      this.emitChanged();
      new BroadcastChannel(`db-changed:${this.dbName}`).postMessage({
        type: 'db-changed',
        dbName: this.dbName,
      } satisfies DbChangedNotify);
    }
  }

  private async requestOnce(op: string, payload: unknown): Promise<unknown> {
    if (this.session.role === 'owner') {
      const response = await this.session.owner.handleRequest({
        id: this.nextId(),
        dbName: this.dbName,
        op,
        payload,
      } as RpcRequest);
      if (!response.ok) throw new Error(response.error.message);
      if (op === 'run' || op === 'commitTx') {
        this.emitChanged();
        this.session.port?.postMessage({
          type: 'db-changed',
          dbName: this.dbName,
        } satisfies DbChangedNotify);
      }
      return response.result;
    }
    const id = this.nextId();
    return awaitRpcResponse({
      id,
      op,
      pending: this.pending,
      timers: this.timers,
      timeoutMs: 3_000,
      send: () => {
        const msg = {
          id,
          dbName: this.dbName,
          op,
          payload,
          from: this.tabId,
        };
        if (this.session.port !== null) this.session.port.postMessage(msg);
        else this.rpcChannel?.postMessage(msg);
      },
    });
  }

  private async request(op: string, payload: unknown): Promise<unknown> {
    try {
      return await this.requestOnce(op, payload);
    } catch (error: unknown) {
      const isTimeout =
        error instanceof Error && error.name === 'RpcTimeoutError';
      if (!isTimeout || this.session.port !== null) throw error;
      await this.dropOwnership();
      this.releaseLock?.();
      this.releaseLock = null;
      await this.connectLeader();
      return this.requestOnce(op, payload);
    }
  }

  async disconnect(): Promise<void> {
    if (this.session.heartbeatTimer !== null) {
      this.timers.clearTimeout(this.session.heartbeatTimer);
    }
    if (this.session.port !== null) {
      const id = this.nextId();
      try {
        await awaitRpcResponse({
          id,
          op: 'disconnect',
          pending: this.pending,
          timers: this.timers,
          timeoutMs: 2000,
          send: () => {
            this.session.port?.postMessage({
              id,
              dbName: this.dbName,
              op: 'disconnect',
              payload: {},
            });
          },
        });
      } catch {
        // ignore
      }
      this.session.port.close();
      this.session.port = null;
    }
    await this.dropOwnership();
    this.releaseLock?.();
    this.releaseLock = null;
    this.rpcChannel?.close();
    this.rpcChannel = null;
    this.session.worker = null;
    this.session.role = null;
  }

  run(statement: string, values: Value[] = []): Promise<unknown> {
    return this.request('run', serializeSql(makeSql(statement, values)));
  }

  query(statement: string, values: Value[] = []): Promise<unknown> {
    return this.request('query', serializeSql(makeSql(statement, values)));
  }

  async beginAbandonedTx(): Promise<void> {
    await this.request('beginTx', {});
  }

  isOwner(): boolean {
    return this.session.role === 'owner';
  }

  onChanged(fn: () => void): void {
    this.changeListeners.add(fn);
  }
}

export function createHarnessClient(args: {
  readonly dbName: string;
  readonly forceLeader: boolean;
  readonly timers?: Timers;
}): HarnessClient {
  return new HarnessClientImpl({
    dbName: args.dbName,
    forceLeader: args.forceLeader,
    timers: args.timers ?? wallTimers,
  });
}
