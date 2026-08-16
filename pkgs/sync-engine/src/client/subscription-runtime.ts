import { sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';
import type { QueryRequestItem } from '../protocol';
import type { QueryResponse } from '../queries/core/types';
import { scopeHash } from '../queries/shared/canonical';
import {
  type AppLifecycle,
  type AppLifecycleEvent,
  alwaysOnLifecycle,
} from './app-lifecycle';
import { applyFullMerge, detachScope, type MergeApplierDeps } from './merge';
import type { Timers } from './sim-ports';
import { QUERY_COALESCE_MS } from './subscription-constants';

/** Host/port alias of protocol {@link QueryRequestItem}. */
export type QueryRequest = QueryRequestItem;

export type QuerySubscriptionSpec = {
  readonly name: string;
  readonly params: Readonly<Record<string, unknown>>;
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

type Entry = {
  readonly spec: QuerySubscriptionSpec;
  readonly scope: string;
  firstSync: Promise<void>;
  resolveFirst: () => void;
  firstDone: boolean;
  refs: number;
  generation: number;
  stopped: boolean;
};

/** `'all'` = every active scope; otherwise a scope subset. */
type PendingSweep = 'all' | Set<string>;

export type SubscriptionRuntimeOptions = {
  readonly db: SqlClient;
  readonly postQueries: (
    requests: readonly QueryRequest[]
  ) => Promise<readonly QueryResponse[]>;
  readonly getMergeDeps: () => MergeApplierDeps;
  readonly onError: (error: unknown) => void;
  readonly onSynced: () => void;
  readonly lifecycle?: AppLifecycle;
  readonly timers: Timers;
  /** Coalesce window override (default QUERY_COALESCE_MS). */
  readonly coalesceMs?: number;
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

function markFirst(entry: Entry): void {
  if (entry.firstDone) return;
  entry.firstDone = true;
  entry.resolveFirst();
}

function resetFirst(entry: Entry): void {
  entry.firstDone = false;
  entry.firstSync = new Promise<void>((resolve) => {
    entry.resolveFirst = resolve;
  });
  entry.stopped = false;
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

async function loadBasis(
  db: SqlClient,
  scope: string
): Promise<{ last_checkpoint: string | null; last_hash: string | null }> {
  const rows = await db.query(sql<{
    last_checkpoint: string | null;
    last_hash: string | null;
  }>`
    SELECT last_checkpoint, last_hash
    FROM sync_engine_scope_meta
    WHERE scope_hash = ${scope}
    LIMIT 1
  `);
  const meta = rows[0];
  return {
    last_checkpoint: meta?.last_checkpoint ?? null,
    last_hash: meta?.last_hash ?? null,
  };
}

/** Owns event-driven query scopes; applies responses to local SQLite. */
export class SubscriptionRuntime {
  private readonly entries = new Map<string, Entry>();
  private readonly changeListeners = new Set<() => void>();
  private afterSweep: ((scopes: readonly string[]) => void) | null = null;
  private readonly lifecycle: AppLifecycle;
  private readonly timers: Timers;
  private readonly coalesceMs: number;
  private running = false;
  private foregrounded = true;
  private disposeLifecycle: (() => void) | null = null;
  private pending: PendingSweep | null = null;
  private coalesceTimer: unknown = null;
  private inFlight = false;
  private flushWaiters: Array<() => void> = [];

  constructor(private readonly options: SubscriptionRuntimeOptions) {
    this.lifecycle = options.lifecycle ?? alwaysOnLifecycle();
    this.timers = options.timers;
    this.coalesceMs = options.coalesceMs ?? QUERY_COALESCE_MS;
    this.foregrounded = this.lifecycle.isForeground();
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.foregrounded = this.lifecycle.isForeground();
    this.disposeLifecycle = this.lifecycle.subscribe((event) =>
      this.onLifecycle(event)
    );
    this.enqueue('all');
  }

  stop(): void {
    this.running = false;
    this.clearCoalesceTimer();
    this.pending = null;
    this.disposeLifecycle?.();
    this.disposeLifecycle = null;
    for (const entry of this.entries.values()) entry.generation += 1;
    this.resolveFlushWaiters();
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
    // Mutation ack intentionally invalidates in-flight sweeps. If first-sync
    // gates are still open, re-enqueue those scopes — otherwise waitForFirstSync
    // hangs forever when a topic-filtered wake omits a stale scope (playground
    // snapshot mutation replay during boot).
    const needFirst = [...this.entries.values()]
      .filter((e) => !e.firstDone && !e.stopped && e.refs > 0)
      .map((e) => e.scope);
    if (needFirst.length > 0) this.enqueue(needFirst);
  }

  /**
   * Wake every active scope and resolve after the resulting sweep drains.
   * Does not reset first-sync gates (no loading flicker for pull-to-refresh).
   */
  wakeAllAndDrain(): Promise<void> {
    if (!this.running || !this.foregrounded) return Promise.resolve();
    this.enqueue('all');
    if (this.pending === null && !this.inFlight) return Promise.resolve();
    return new Promise((resolve) => {
      this.flushWaiters.push(resolve);
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
      return;
    }
    if (event === 'background') {
      this.foregrounded = false;
      this.clearCoalesceTimer();
    }
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
        void this.flushPending();
      });
      return;
    }
    this.coalesceTimer = this.timers.setTimeout(() => {
      this.coalesceTimer = null;
      void this.flushPending();
    }, this.coalesceMs);
  }

  private async flushPending(): Promise<void> {
    if (!this.running || !this.foregrounded) {
      this.resolveFlushWaiters();
      return;
    }
    if (this.inFlight) return;
    const pending = this.pending;
    if (pending === null) {
      this.resolveFlushWaiters();
      return;
    }
    this.pending = null;
    const active =
      pending === 'all'
        ? this.listSweepEntries()
        : this.listSweepEntries().filter((e) => pending.has(e.scope));
    if (active.length === 0) {
      this.resolveFlushWaiters();
      return;
    }
    this.inFlight = true;
    try {
      await this.sweepEntries(active);
    } finally {
      this.inFlight = false;
      if (this.pending !== null) this.scheduleFlush();
      else this.resolveFlushWaiters();
    }
  }

  private listSweepEntries(): Entry[] {
    return [...this.entries.values()].filter((e) => !e.stopped && e.refs > 0);
  }

  private async sweepEntries(active: readonly Entry[]): Promise<void> {
    if (active.length === 0) return;
    for (const entry of active) entry.generation += 1;
    const gens = new Map(active.map((e) => [e.scope, e.generation]));
    try {
      const requests = await this.buildRequests(active);
      const responses = await this.options.postQueries(requests);
      await this.applySweepResponses({ active, gens, responses });
      this.afterSweep?.(active.map((e) => e.scope));
    } catch (error) {
      this.options.onError(error);
    }
  }

  private async buildRequests(
    active: readonly Entry[]
  ): Promise<QueryRequest[]> {
    const requests: QueryRequest[] = [];
    for (const entry of active) {
      const basis = await loadBasis(this.options.db, entry.scope);
      requests.push({
        name: entry.spec.name,
        params: entry.spec.params,
        ...(basis.last_hash !== null ? { lastHash: basis.last_hash } : {}),
        ...(basis.last_checkpoint !== null
          ? { checkpoint: basis.last_checkpoint }
          : {}),
      });
    }
    return requests;
  }

  private async applySweepResponses(args: {
    readonly active: readonly Entry[];
    readonly gens: Map<string, number>;
    readonly responses: readonly QueryResponse[];
  }): Promise<void> {
    for (let i = 0; i < args.active.length; i += 1) {
      const entry = args.active[i]!;
      const response = args.responses[i];
      if (response === undefined) continue;
      if (args.gens.get(entry.scope) !== entry.generation) continue;
      if (!this.running || entry.stopped) continue;
      await this.handleResponse(entry, response);
    }
  }

  private async handleResponse(
    entry: Entry,
    response: QueryResponse
  ): Promise<void> {
    if (response.status === 'denied') {
      await detachScope(this.options.getMergeDeps(), entry.scope);
      entry.stopped = true;
      markFirst(entry);
      return;
    }
    if (response.status === 'not_modified') {
      markFirst(entry);
      this.options.onSynced();
      return;
    }
    await applyFullMerge(this.options.getMergeDeps(), {
      scopeHash: entry.scope,
      checkpoint: response.checkpoint,
      hash: response.hash,
      tables: response.tables,
    });
    markFirst(entry);
    this.options.onSynced();
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

  private resolveFlushWaiters(): void {
    if (this.flushWaiters.length === 0) return;
    const waiters = this.flushWaiters.splice(0);
    for (const resolve of waiters) resolve();
  }

  private clearCoalesceTimer(): void {
    if (this.coalesceTimer === null) return;
    if (this.coalesceTimer !== 'microtask') {
      this.timers.clearTimeout(this.coalesceTimer);
    }
    this.coalesceTimer = null;
  }
}
