import type { Timers } from '@pkgs/clock-shared-ts/types';
import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';
import type {
  AppLifecycle,
  AppLifecycleEvent,
} from '@pkgs/sync-engine-shared-ts/app-lifecycle';
import { alwaysOnLifecycle } from '@pkgs/sync-engine-shared-ts/app-lifecycle';
import { scopeHash } from '@pkgs/sync-engine-shared-ts/canonical';
import type { QueryRegistry } from '@pkgs/sync-engine-shared-ts/queries-types';
import type {
  QueryRequestItem,
  QueryResponse,
} from '@pkgs/sync-engine-shared-ts/v2';
import type { MergeApplierDeps } from './merge';
import { detachScope } from './merge';
import { raceUntilAborted } from './race-until-aborted';
import {
  QUERY_COALESCE_MS,
  QUERY_RECONCILE_INTERVAL_MS,
} from './subscription-constants';
import type {
  SubscriptionSweepContext,
  SweepEntry,
} from './subscription-runtime-sweep';
import { runSubscriptionSweep } from './subscription-runtime-sweep';

/** Runtime/port alias of protocol {@link QueryRequestItem}. */
export type QueryRequest = QueryRequestItem;

export type QuerySubscriptionSpec = {
  readonly name: string;
  readonly params: Readonly<Record<string, unknown>>;
  /** Session startup can paint its cache after a failed network attempt. */
  readonly settleOnNetworkError?: boolean;
};

export type QuerySubscription = {
  readonly unsubscribe: () => void;
  readonly waitForFirstSync: () => Promise<void>;
};

export type ActiveSubscription = {
  readonly scope: string;
  readonly name: string;
  readonly params: Readonly<Record<string, unknown>>;
};

type Entry = SweepEntry;

/** `'all'` = every active scope; otherwise a scope subset. */
type PendingSweep = 'all' | Set<string>;
const STOPPED_QUERY = new Error('Subscription query lifecycle stopped');

export type SubscriptionRuntimeOptions = {
  readonly db: SqlClient;
  readonly postQueries: (
    requests: readonly QueryRequest[]
  ) => Promise<readonly QueryResponse[]>;
  readonly getMergeDeps: () => MergeApplierDeps;
  /** When set, local content hash is checked before sending `lastHash`. */
  readonly queryRegistry?: QueryRegistry;
  readonly onError: (error: unknown) => void;
  readonly onSynced: () => void;
  readonly onSweepStarted?: (scopes: readonly string[]) => void;
  readonly onScopeSettled?: (scope: string) => void;
  readonly lifecycle?: AppLifecycle;
  readonly timers: Timers;
  /** Coalesce window override (default QUERY_COALESCE_MS). */
  readonly coalesceMs?: number;
  /**
   * Safety-net refetch interval (default {@link QUERY_RECONCILE_INTERVAL_MS}).
   * `<= 0` disables the tick.
   */
  readonly reconcileIntervalMs?: number;
};

function createEntry(spec: QuerySubscriptionSpec): Entry {
  let resolveFirst = (): void => undefined;
  const firstSync = new Promise<void>((resolve) => {
    resolveFirst = resolve;
  });
  return {
    spec,
    scope: scopeHash(spec.name, spec.params),
    firstSync,
    resolveFirst,
    firstDone: false,
    refs: 0,
    generation: 0,
    stopped: false,
  };
}

function resetFirst(entry: Entry): void {
  entry.stopped = false;
  if (!entry.firstDone) return;
  entry.firstDone = false;
  entry.firstSync = new Promise<void>((resolve) => {
    entry.resolveFirst = resolve;
  });
}

function mergePending(
  current: PendingSweep | null,
  next: 'all' | Iterable<string>
): PendingSweep {
  if (next === 'all' || current === 'all') return 'all';
  const set = current ?? new Set<string>();
  for (const scope of next) set.add(scope);
  return set;
}

function resolveWaiters(waiters: Array<() => void>): void {
  if (waiters.length === 0) return;
  const pending = waiters.splice(0);
  for (const resolve of pending) resolve();
}

/** A {@link SubscriptionRuntime.wakeAllAndDrain} caller: done once sweep `after` finishes. */
type FlushWaiter = { readonly after: number; readonly resolve: () => void };

function resolveFlushWaiters(waiters: FlushWaiter[], sweepsDone: number): void {
  for (let i = waiters.length - 1; i >= 0; i -= 1) {
    const waiter = waiters[i]!;
    if (waiter.after > sweepsDone) continue;
    waiters.splice(i, 1);
    waiter.resolve();
  }
}

/** Owns event-driven query scopes; applies responses to local SQLite. */
export class SubscriptionRuntime {
  private readonly entries = new Map<string, Entry>();
  private readonly changeListeners = new Set<() => void>();
  private afterSweep: ((scopes: readonly string[]) => void) | null = null;
  private readonly lifecycle: AppLifecycle;
  private readonly timers: Timers;
  private readonly coalesceMs: number;
  private readonly reconcileIntervalMs: number;
  private running = false;
  private foregrounded = true;
  private disposeLifecycle: (() => void) | null = null;
  private disposeBus: (() => void) | null = null;
  private pending: PendingSweep | null = null;
  private coalesceTimer: unknown = null;
  private reconcileTimer: unknown = null;
  private inFlight = false;
  private requestAbort = new AbortController();
  private inFlightScopes: readonly string[] = [];
  private flushWaiters: FlushWaiter[] = [];
  /** Sweeps finished so far; orders {@link flushWaiters}. */
  private sweepsDone = 0;
  /** Resolves when the current in-flight sweep finishes after {@link stop}. */
  private inFlightDrain: Array<() => void> = [];
  /**
   * Scopes whose local content matches `sync_engine_scope_meta.last_hash`
   * since the last successful full merge. Cleared on any table-change bus
   * emit (local mutate, row images, peer merge of other scopes).
   */
  private readonly cleanScopes = new Set<string>();

  constructor(private readonly options: SubscriptionRuntimeOptions) {
    this.lifecycle = options.lifecycle ?? alwaysOnLifecycle();
    this.timers = options.timers;
    this.coalesceMs = options.coalesceMs ?? QUERY_COALESCE_MS;
    this.reconcileIntervalMs =
      options.reconcileIntervalMs ?? QUERY_RECONCILE_INTERVAL_MS;
    this.foregrounded = this.lifecycle.isForeground();
  }

  private sweepContext(): SubscriptionSweepContext {
    const signal = this.requestAbort.signal;
    return {
      db: this.options.db,
      postQueries: async (requests) => {
        if (signal.aborted) throw STOPPED_QUERY;
        const responses = await raceUntilAborted(
          this.options.postQueries(requests),
          signal
        );
        if (responses === null) throw STOPPED_QUERY;
        return responses;
      },
      getMergeDeps: this.options.getMergeDeps,
      ...(this.options.queryRegistry !== undefined
        ? { queryRegistry: this.options.queryRegistry }
        : {}),
      onError: this.options.onError,
      onSynced: this.options.onSynced,
      onScopeSettled: (scope) => this.options.onScopeSettled?.(scope),
      ensureBusWatch: () => this.ensureBusWatch(),
      cleanScopes: this.cleanScopes,
      // A restart must not make a prior lifecycle's response current again.
      isRunning: () => this.running && !signal.aborted,
    };
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.requestAbort = new AbortController();
    this.foregrounded = this.lifecycle.isForeground();
    this.disposeLifecycle = this.lifecycle.subscribe((event) =>
      this.onLifecycle(event)
    );
    this.ensureBusWatch();
    this.startReconcileTick();
    this.enqueue('all');
  }

  /**
   * Watch the merge bus so local mutates / row images clear cleanScopes.
   * Best-effort: unit tests may stub getMergeDeps to throw.
   */
  private ensureBusWatch(): void {
    if (this.disposeBus !== null) return;
    try {
      this.disposeBus = this.options.getMergeDeps().bus.subscribe(() => {
        this.cleanScopes.clear();
      });
    } catch (error) {
      // Runtime stubbed getMergeDeps — skip dirty tracking until merge deps exist.
      this.options.onError(error);
    }
  }

  stop(): void {
    this.running = false;
    this.requestAbort.abort();
    this.clearCoalesceTimer();
    this.clearReconcileTick();
    this.pending = null;
    this.cleanScopes.clear();
    this.disposeBus?.();
    this.disposeBus = null;
    this.disposeLifecycle?.();
    this.disposeLifecycle = null;
    for (const entry of this.entries.values()) entry.generation += 1;
    resolveFlushWaiters(this.flushWaiters, Number.POSITIVE_INFINITY);
  }

  /**
   * Stop waiting for HTTP, then drain any SQL work already running so callers
   * can safely close the underlying SqlClient afterward.
   */
  async stopAndDrain(): Promise<void> {
    this.stop();
    if (!this.inFlight) return;
    await new Promise<void>((resolve) => {
      this.inFlightDrain.push(resolve);
    });
  }

  reset(): void {
    for (const entry of this.entries.values()) resetFirst(entry);
  }

  wakeAll(): void {
    if (!this.running || !this.foregrounded) return;
    this.enqueue('all');
  }

  /**
   * Invalidate in-flight query sweeps so their responses are dropped.
   * Used after mutation upload ack so a pre-replay snapshot cannot apply
   * without a subsequent generation-bumped refetch.
   */
  bumpGenerations(): void {
    for (const entry of this.entries.values()) entry.generation += 1;
    const needRefetch = [...this.entries.values()]
      .filter((e) => !e.firstDone && !e.stopped && e.refs > 0)
      .map((e) => e.scope);
    // A push's sole refetch may race the ack, even for an already painted
    // scope. Replace every invalidated in-flight read rather than lose it.
    needRefetch.push(...this.inFlightScopes);
    if (needRefetch.length > 0) this.enqueue(needRefetch);
  }

  /**
   * Wake every active scope and resolve after the resulting sweep drains.
   * Does not reset first-sync gates (no loading flicker for pull-to-refresh).
   * Later wakes never hold it: sweeps that keep being enqueued after it
   * would otherwise leave the caller waiting forever.
   */
  wakeAllAndDrain(): Promise<void> {
    if (!this.running || !this.foregrounded) return Promise.resolve();
    this.enqueue('all');
    if (this.pending === null && !this.inFlight) return Promise.resolve();
    // A sweep in flight started before this wake; the one after it carries it.
    const after = this.sweepsDone + (this.inFlight ? 2 : 1);
    return new Promise((resolve) => {
      this.flushWaiters.push({ after, resolve });
    });
  }

  /** Batch-refetch a subset of active scopes (shared-topic push fanout). */
  wakeScopes(scopes: readonly string[]): void {
    if (!this.running || !this.foregrounded || scopes.length === 0) return;
    this.enqueue(scopes);
  }

  wakeScope(scope: string): void {
    if (!this.running || !this.foregrounded) return;
    this.enqueue([scope]);
  }

  listActive(): readonly ActiveSubscription[] {
    return [...this.entries.values()].map((entry) => ({
      scope: entry.scope,
      name: entry.spec.name,
      params: entry.spec.params,
    }));
  }

  onSubscriptionsChange(cb: () => void): () => void {
    this.changeListeners.add(cb);
    return () => {
      this.changeListeners.delete(cb);
    };
  }

  /**
   * Called after a successful sweep applies responses (ok / not_modified /
   * denied). Used by attachPush to advance `sync_engine_push_applied` after refetch.
   */
  setAfterSweep(cb: ((scopes: readonly string[]) => void) | null): void {
    this.afterSweep = cb;
  }

  /** Await first sync of the given scopes (or all active if omitted). */
  waitForScopes(scopes?: readonly string[]): Promise<void> {
    const wanted = scopes === undefined ? null : new Set(scopes);
    const waits = [...this.entries.values()]
      .filter((entry) => wanted === null || wanted.has(entry.scope))
      .map((entry) => entry.firstSync);
    return Promise.all(waits).then(() => undefined);
  }

  subscribe(spec: QuerySubscriptionSpec): QuerySubscription {
    const entry = this.ensureEntry(spec);
    entry.refs += 1;
    entry.stopped = false;
    if (this.running && !entry.firstDone) {
      this.enqueue([entry.scope]);
    }
    this.emitSubscriptionsChange();
    return {
      waitForFirstSync: () => entry.firstSync,
      unsubscribe: () => this.unsubscribe(entry),
    };
  }

  private onLifecycle(event: AppLifecycleEvent): void {
    if (event === 'foreground') {
      this.foregrounded = true;
      this.startReconcileTick();
      this.wakeAll();
      return;
    }
    if (event === 'background') {
      this.foregrounded = false;
      this.clearCoalesceTimer();
      this.clearReconcileTick();
      return;
    }
    if (event === 'online') {
      if (this.foregrounded) {
        this.startReconcileTick();
        this.wakeAll();
      }
      return;
    }
    if (event === 'offline') {
      this.clearCoalesceTimer();
    }
  }

  private startReconcileTick(): void {
    if (this.reconcileTimer !== null) return;
    if (this.reconcileIntervalMs <= 0) return;
    if (!this.running || !this.foregrounded) return;
    this.reconcileTimer = this.timers.setInterval(() => {
      this.wakeAll();
    }, this.reconcileIntervalMs);
  }

  private clearReconcileTick(): void {
    if (this.reconcileTimer === null) return;
    this.timers.clearInterval(this.reconcileTimer);
    this.reconcileTimer = null;
  }

  private ensureEntry(spec: QuerySubscriptionSpec): Entry {
    const key = scopeHash(spec.name, spec.params);
    const existing = this.entries.get(key);
    if (existing !== undefined) return existing;
    const entry = createEntry(spec);
    this.entries.set(key, entry);
    this.emitSubscriptionsChange();
    return entry;
  }

  private unsubscribe(entry: Entry): void {
    entry.refs = Math.max(0, entry.refs - 1);
    if (entry.refs > 0) return;
    entry.generation += 1;
    this.entries.delete(entry.scope);
    this.emitSubscriptionsChange();
    void detachScope(this.options.getMergeDeps(), entry.scope).catch(
      this.options.onError
    );
  }

  private enqueue(scopes: 'all' | Iterable<string>): void {
    if (!this.running || !this.foregrounded) return;
    this.pending = mergePending(this.pending, scopes);
    this.scheduleFlush();
  }

  private scheduleFlush(): void {
    if (this.coalesceTimer !== null || this.inFlight) return;
    if (this.coalesceMs <= 0) {
      this.coalesceTimer = 'microtask';
      void Promise.resolve().then(() => {
        if (this.coalesceTimer !== 'microtask') return;
        this.coalesceTimer = null;
        void this.flushPending().catch(this.options.onError);
      });
      return;
    }
    this.coalesceTimer = this.timers.setTimeout(() => {
      this.coalesceTimer = null;
      void this.flushPending().catch(this.options.onError);
    }, this.coalesceMs);
  }

  private async flushPending(): Promise<void> {
    if (!this.running || !this.foregrounded) {
      resolveFlushWaiters(this.flushWaiters, Number.POSITIVE_INFINITY);
      return;
    }
    if (this.inFlight) return;
    const pending = this.pending;
    if (pending === null) {
      resolveFlushWaiters(this.flushWaiters, Number.POSITIVE_INFINITY);
      return;
    }
    this.pending = null;
    const active =
      pending === 'all'
        ? this.listSweepEntries()
        : this.listSweepEntries().filter((e) => pending.has(e.scope));
    if (active.length === 0) {
      resolveFlushWaiters(this.flushWaiters, Number.POSITIVE_INFINITY);
      return;
    }
    this.inFlight = true;
    this.inFlightScopes = active.map((e) => e.scope);
    const ctx = this.sweepContext();
    try {
      this.options.onSweepStarted?.(active.map((entry) => entry.scope));
      await runSubscriptionSweep(ctx, active);
      if (ctx.isRunning()) {
        this.afterSweep?.(active.map((e) => e.scope));
      }
    } catch (error) {
      if (error !== STOPPED_QUERY) this.options.onError(error);
    } finally {
      this.inFlight = false;
      this.inFlightScopes = [];
      this.sweepsDone += 1;
      resolveWaiters(this.inFlightDrain);
      resolveFlushWaiters(this.flushWaiters, this.sweepsDone);
      if (this.pending !== null) this.scheduleFlush();
    }
  }

  private listSweepEntries(): Entry[] {
    return [...this.entries.values()].filter((e) => !e.stopped && e.refs > 0);
  }

  private emitSubscriptionsChange(): void {
    for (const cb of [...this.changeListeners]) {
      try {
        cb();
      } catch (error) {
        this.options.onError(error);
      }
    }
  }

  private clearCoalesceTimer(): void {
    if (this.coalesceTimer === null) return;
    if (this.coalesceTimer !== 'microtask') {
      this.timers.clearTimeout(this.coalesceTimer);
    }
    this.coalesceTimer = null;
  }
}
