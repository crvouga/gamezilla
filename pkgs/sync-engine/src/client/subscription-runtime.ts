import type { SqlClient } from '@pkgs/sql-client/interface';
import {
  purgeScope,
  type MergeApplierDeps,
} from '@pkgs/sync-engine/queries/client/merge-applier';
import type { QueryResponse } from '@pkgs/sync-engine/queries/core/types';
import { scopeHash } from '@pkgs/sync-engine/queries/shared/canonical';

import {
  alwaysOnLifecycle,
  type AppLifecycle,
  type AppLifecycleEvent,
} from './app-lifecycle';
import { LIFECYCLE_SWEEP_JITTER_MS } from './subscription-constants';
import {
  applyQueryResponse,
  loadBasis,
  requestFromBasis,
  type QueryRequest,
} from './subscription-fetch';
import {
  resolveFallbackPollMs,
  resolveReconcileMs,
  SharedPollScheduler,
  type SweepReason,
} from './shared-poll-scheduler';

export type { QueryRequest };

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
  boot: boolean;
  refs: number;
  generation: number;
  stopped: boolean;
};

export type SubscriptionRuntimeOptions = {
  readonly db: SqlClient;
  readonly boot: readonly QuerySubscriptionSpec[];
  readonly postQuery: (request: QueryRequest) => Promise<QueryResponse>;
  readonly postQueryBatch?: (
    requests: readonly QueryRequest[]
  ) => Promise<readonly QueryResponse[]>;
  readonly getMergeDeps: () => MergeApplierDeps;
  readonly onError: (error: unknown) => void;
  readonly onSynced: () => void;
  readonly lifecycle?: AppLifecycle;
  /** Test override for FALLBACK_POLL_MS. */
  readonly fallbackPollMs?: number;
  /** Test override for RECONCILE_MS. */
  readonly reconcileMs?: number;
  readonly now?: () => number;
  readonly random?: () => number;
  /** Fired when a reconcile sweep applies a full (changed) response. */
  readonly onMissedEvent?: (info: {
    readonly scope: string;
    readonly name: string;
  }) => void;
};

function createEntry(spec: QuerySubscriptionSpec, boot: boolean): Entry {
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
    boot,
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

/** Owns event-driven query scopes; applies responses to local SQLite. */
export class SubscriptionRuntime {
  private readonly entries = new Map<string, Entry>();
  private readonly changeListeners = new Set<() => void>();
  private readonly jitterTimers = new Set<ReturnType<typeof setTimeout>>();
  private readonly lifecycle: AppLifecycle;
  private readonly scheduler: SharedPollScheduler;
  private readonly now: () => number;
  private readonly random: () => number;
  private running = false;
  private connectedMode = false;
  private foregrounded = true;
  private lastSweepAt = 0;
  private disposeLifecycle: (() => void) | null = null;

  constructor(private readonly options: SubscriptionRuntimeOptions) {
    this.lifecycle = options.lifecycle ?? alwaysOnLifecycle();
    this.now = options.now ?? Date.now;
    this.random = options.random ?? Math.random;
    this.foregrounded = this.lifecycle.isForeground();
    this.scheduler = new SharedPollScheduler({
      isRunning: () => this.running,
      isForeground: () => this.foregrounded,
      isConnectedMode: () => this.connectedMode,
      sweepWithJitter: (maxMs, reason) => this.wakeAllWithJitter(maxMs, reason),
      millisSinceLastSweep: () => this.now() - this.lastSweepAt,
      now: this.now,
      random: this.random,
      fallbackPollMs: resolveFallbackPollMs(options.fallbackPollMs),
      reconcileMs: resolveReconcileMs(options.reconcileMs),
    });
    for (const spec of options.boot) this.ensureEntry(spec, true);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.foregrounded = this.lifecycle.isForeground();
    this.disposeLifecycle = this.lifecycle.subscribe((event) =>
      this.onLifecycle(event)
    );
    this.scheduler.start();
    for (const entry of this.entries.values()) this.fetchEntry(entry);
  }

  stop(): void {
    this.running = false;
    this.clearJitterTimers();
    this.scheduler.stop();
    this.disposeLifecycle?.();
    this.disposeLifecycle = null;
    for (const entry of this.entries.values()) entry.generation += 1;
  }

  reset(): void {
    for (const entry of this.entries.values()) resetFirst(entry);
  }

  wakeAll(reason: SweepReason = 'manual'): void {
    if (!this.running || !this.foregrounded) return;
    void this.sweepEntries(this.listSweepEntries(), reason);
  }

  /** Batch-refetch a subset of active scopes (shared-topic nudge fanout). */
  wakeScopes(scopes: readonly string[], reason: SweepReason = 'nudge'): void {
    if (!this.running || !this.foregrounded || scopes.length === 0) return;
    const wanted = new Set(scopes);
    const active = this.listSweepEntries().filter((e) => wanted.has(e.scope));
    void this.sweepEntries(active, reason);
  }

  wakeScope(scope: string): void {
    if (!this.running || !this.foregrounded) return;
    const entry = this.entries.get(scope);
    if (entry === undefined) return;
    this.fetchEntry(entry);
  }

  wakeAllWithJitter(maxMs: number, reason: SweepReason = 'manual'): void {
    if (!this.running || !this.foregrounded) return;
    this.clearJitterTimers();
    const delayMs = Math.floor(this.random() * Math.max(0, maxMs));
    const timer = setTimeout(() => {
      this.jitterTimers.delete(timer);
      this.wakeAll(reason);
    }, delayMs);
    this.jitterTimers.add(timer);
  }

  setConnectedMode(connected: boolean): void {
    this.connectedMode = connected;
    this.scheduler.refresh();
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

  waitForBoot(): Promise<void> {
    const waits = [...this.entries.values()]
      .filter((entry) => entry.boot)
      .map((entry) => entry.firstSync);
    return Promise.all(waits).then(() => undefined);
  }

  subscribe(spec: QuerySubscriptionSpec): QuerySubscription {
    const entry = this.ensureEntry(spec, false);
    entry.refs += 1;
    entry.stopped = false;
    if (this.running) {
      this.fetchEntry(entry);
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
      this.scheduler.refresh();
      this.wakeAllWithJitter(LIFECYCLE_SWEEP_JITTER_MS, 'lifecycle');
      return;
    }
    if (event === 'background') {
      this.foregrounded = false;
      this.clearJitterTimers();
      this.scheduler.refresh();
      return;
    }
    if (event === 'online' && this.foregrounded) {
      this.wakeAllWithJitter(LIFECYCLE_SWEEP_JITTER_MS, 'lifecycle');
    }
  }

  private ensureEntry(spec: QuerySubscriptionSpec, boot: boolean): Entry {
    const key = scopeHash(spec.name, spec.params);
    const existing = this.entries.get(key);
    if (existing !== undefined) {
      existing.boot ||= boot;
      return existing;
    }
    const entry = createEntry(spec, boot);
    this.entries.set(key, entry);
    this.emitSubscriptionsChange();
    return entry;
  }

  private unsubscribe(entry: Entry): void {
    entry.refs = Math.max(0, entry.refs - 1);
    if (entry.boot || entry.refs > 0) return;
    entry.generation += 1;
    this.entries.delete(entry.scope);
    this.emitSubscriptionsChange();
    void purgeScope(this.options.getMergeDeps(), entry.scope).catch(
      this.options.onError
    );
  }

  private fetchEntry(entry: Entry): void {
    if (entry.stopped || (!entry.boot && entry.refs === 0)) return;
    if (!this.running || !this.foregrounded) return;
    entry.generation += 1;
    const generation = entry.generation;
    void this.fetchOnce(entry, generation, false);
  }

  private async fetchOnce(
    entry: Entry,
    generation: number,
    detectMissed: boolean
  ): Promise<void> {
    if (!this.alive(entry, generation)) return;
    try {
      const basis = await loadBasis(this.options.db, entry.scope);
      if (!this.alive(entry, generation)) return;
      const response = await this.options.postQuery(
        requestFromBasis(
          {
            scope: entry.scope,
            name: entry.spec.name,
            params: entry.spec.params,
          },
          basis
        )
      );
      if (!this.alive(entry, generation)) return;
      await this.handleResponse(
        entry,
        response,
        detectMissed,
        basis.write_epoch
      );
    } catch (error) {
      this.options.onError(error);
    }
  }

  private listSweepEntries(): Entry[] {
    return [...this.entries.values()].filter(
      (e) => !e.stopped && (e.boot || e.refs > 0)
    );
  }

  private async sweepEntries(
    active: readonly Entry[],
    reason: SweepReason
  ): Promise<void> {
    this.lastSweepAt = this.now();
    if (active.length === 0) return;
    for (const entry of active) entry.generation += 1;
    const gens = new Map(active.map((e) => [e.scope, e.generation]));
    const detectMissed = reason === 'reconcile';
    try {
      const built = await this.buildRequests(active);
      const responses = await this.postBatchOrSequential(built.requests);
      await this.applySweepResponses({
        active,
        gens,
        responses,
        detectMissed,
        basisEpochs: built.basisEpochs,
      });
    } catch (error) {
      this.options.onError(error);
    }
  }

  private async buildRequests(active: readonly Entry[]): Promise<{
    readonly requests: QueryRequest[];
    readonly basisEpochs: number[];
  }> {
    const requests: QueryRequest[] = [];
    const basisEpochs: number[] = [];
    for (const entry of active) {
      const basis = await loadBasis(this.options.db, entry.scope);
      basisEpochs.push(basis.write_epoch);
      requests.push(
        requestFromBasis(
          {
            scope: entry.scope,
            name: entry.spec.name,
            params: entry.spec.params,
          },
          basis
        )
      );
    }
    return { requests, basisEpochs };
  }

  private async postBatchOrSequential(
    requests: readonly QueryRequest[]
  ): Promise<readonly QueryResponse[]> {
    if (this.options.postQueryBatch !== undefined) {
      return this.options.postQueryBatch(requests);
    }
    return Promise.all(requests.map((r) => this.options.postQuery(r)));
  }

  private async applySweepResponses(args: {
    readonly active: readonly Entry[];
    readonly gens: Map<string, number>;
    readonly responses: readonly QueryResponse[];
    readonly detectMissed: boolean;
    readonly basisEpochs: readonly number[];
  }): Promise<void> {
    for (let i = 0; i < args.active.length; i += 1) {
      const entry = args.active[i]!;
      const response = args.responses[i];
      if (response === undefined) continue;
      if (args.gens.get(entry.scope) !== entry.generation) continue;
      if (!this.running || entry.stopped) continue;
      await this.handleResponse(
        entry,
        response,
        args.detectMissed,
        args.basisEpochs[i] ?? 0
      );
    }
  }

  private async handleResponse(
    entry: Entry,
    response: QueryResponse,
    detectMissed: boolean,
    basisEpoch: number
  ): Promise<void> {
    const action = await applyQueryResponse(
      {
        db: this.options.db,
        getMergeDeps: this.options.getMergeDeps,
        onSynced: this.options.onSynced,
        markFirst: (scope) => {
          const e = this.entries.get(scope);
          if (e !== undefined) markFirst(e);
        },
      },
      { scope: entry.scope, name: entry.spec.name, params: entry.spec.params },
      response,
      basisEpoch
    );
    if (action === 'stop') entry.stopped = true;
    if (action === 'resync') {
      void this.fetchOnce(entry, entry.generation, detectMissed);
      return;
    }
    if (action === 'full' && detectMissed) {
      this.options.onMissedEvent?.({
        scope: entry.scope,
        name: entry.spec.name,
      });
      console.warn('[sync] missed_sync_event', entry.spec.name, entry.scope);
    }
  }

  private alive(entry: Entry, generation: number): boolean {
    return (
      this.running &&
      this.foregrounded &&
      entry.generation === generation &&
      !entry.stopped
    );
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

  private clearJitterTimers(): void {
    for (const timer of this.jitterTimers) clearTimeout(timer);
    this.jitterTimers.clear();
  }
}
