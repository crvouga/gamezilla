import { sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';
import {
  applyFullMerge,
  purgeScope,
  type MergeApplierDeps,
} from '@pkgs/sync-engine/queries/client/merge-applier';
import type { QueryResponse } from '@pkgs/sync-engine/queries/core/types';
import { scopeHash } from '@pkgs/sync-engine/queries/shared/canonical';

export const DEFAULT_POLL_MS = 5_000;
const ERROR_POLL_MS = 2_000;
export const DEFAULT_POLL_MS_LAZY = 30_000;

export type QuerySubscriptionSpec = {
  readonly name: string;
  readonly params: Readonly<Record<string, unknown>>;
  readonly pollMs?: number | undefined;
  readonly pollMsLazy?: number | undefined;
};

export type QuerySubscription = {
  readonly unsubscribe: () => void;
  readonly waitForFirstSync: () => Promise<void>;
};

export type QueryRequest = {
  readonly name: string;
  readonly params: Readonly<Record<string, unknown>>;
  readonly lastHash?: string | undefined;
  readonly checkpoint?: string | undefined;
};

export type ActiveSubscription = {
  readonly scope: string;
  readonly name: string;
  readonly params: Readonly<Record<string, unknown>>;
  readonly pollMs: number;
  readonly pollMsLazy: number;
};

type ScopeBasis = {
  readonly last_checkpoint: string | null;
  readonly last_hash: string | null;
};

type Entry = {
  readonly spec: QuerySubscriptionSpec;
  readonly scope: string;
  readonly pollMs: number;
  readonly pollMsLazy: number;
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
  readonly getMergeDeps: () => MergeApplierDeps;
  readonly onError: (error: unknown) => void;
  readonly onSynced: () => void;
};

function resolvePollMs(spec: QuerySubscriptionSpec): number {
  return spec.pollMs ?? DEFAULT_POLL_MS;
}

function resolvePollMsLazy(spec: QuerySubscriptionSpec): number {
  if (spec.pollMsLazy !== undefined) return spec.pollMsLazy;
  return Math.max(resolvePollMs(spec), DEFAULT_POLL_MS_LAZY);
}

function createEntry(spec: QuerySubscriptionSpec, boot: boolean): Entry {
  let resolveFirst = (): void => undefined;
  const firstSync = new Promise<void>((resolve) => {
    resolveFirst = resolve;
  });
  return {
    spec,
    scope: scopeHash(spec.name, spec.params),
    pollMs: resolvePollMs(spec),
    pollMsLazy: resolvePollMsLazy(spec),
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

async function loadBasis(db: SqlClient, scope: string): Promise<ScopeBasis> {
  const rows = await db.query(sql<ScopeBasis>`
    SELECT last_checkpoint, last_hash
    FROM _scope_meta
    WHERE scope_hash = ${scope}
    LIMIT 1
  `);
  return rows[0] ?? { last_checkpoint: null, last_hash: null };
}

function requestFromBasis(entry: Entry, basis: ScopeBasis): QueryRequest {
  return {
    name: entry.spec.name,
    params: entry.spec.params,
    ...(basis.last_hash !== null ? { lastHash: basis.last_hash } : {}),
    ...(basis.last_checkpoint !== null
      ? { checkpoint: basis.last_checkpoint }
      : {}),
  };
}

async function clearBasis(db: SqlClient, scope: string): Promise<void> {
  await db.run(sql`DELETE FROM _scope_meta WHERE scope_hash = ${scope}`);
}

async function applyResponse(
  options: SubscriptionRuntimeOptions,
  entry: Entry,
  response: QueryResponse
): Promise<'continue' | 'resync' | 'stop'> {
  if (response.status === 'resync') {
    await clearBasis(options.db, entry.scope);
    return 'resync';
  }
  if (response.status === 'denied' || response.status === 'gone') {
    await purgeScope(options.getMergeDeps(), entry.scope);
    markFirst(entry);
    return 'stop';
  }
  if (response.status === 'not_modified') {
    markFirst(entry);
    options.onSynced();
    return 'continue';
  }
  if (response.mode !== 'full') {
    throw new Error(`Unsupported query response mode: ${response.mode}`);
  }
  await applyFullMerge(options.getMergeDeps(), {
    scopeHash: entry.scope,
    checkpoint: response.checkpoint,
    hash: response.hash,
    tables: response.tables,
  });
  markFirst(entry);
  options.onSynced();
  return 'continue';
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Owns polling query scopes and applies full responses to local SQLite. */
export class SubscriptionRuntime {
  private readonly entries = new Map<string, Entry>();
  private readonly changeListeners = new Set<() => void>();
  private running = false;
  private connectedMode = false;
  private readonly jitterTimers = new Set<ReturnType<typeof setTimeout>>();

  constructor(private readonly options: SubscriptionRuntimeOptions) {
    for (const spec of options.boot) this.ensureEntry(spec, true);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    for (const entry of this.entries.values()) this.startEntry(entry);
  }

  stop(): void {
    this.running = false;
    this.clearJitterTimers();
    for (const entry of this.entries.values()) entry.generation += 1;
  }

  reset(): void {
    for (const entry of this.entries.values()) resetFirst(entry);
  }

  wakeAll(): void {
    if (!this.running) return;
    for (const entry of this.entries.values()) {
      entry.generation += 1;
      this.startEntry(entry);
    }
  }

  wakeScope(scope: string): void {
    if (!this.running) return;
    const entry = this.entries.get(scope);
    if (entry === undefined) return;
    entry.generation += 1;
    this.startEntry(entry);
  }

  wakeAllWithJitter(maxMs: number): void {
    if (!this.running) return;
    this.clearJitterTimers();
    for (const entry of this.entries.values()) {
      const delayMs = Math.floor(Math.random() * Math.max(0, maxMs));
      const timer = setTimeout(() => {
        this.jitterTimers.delete(timer);
        this.wakeScope(entry.scope);
      }, delayMs);
      this.jitterTimers.add(timer);
    }
  }

  setConnectedMode(connected: boolean): void {
    this.connectedMode = connected;
  }

  listActive(): readonly ActiveSubscription[] {
    return [...this.entries.values()].map((entry) => ({
      scope: entry.scope,
      name: entry.spec.name,
      params: entry.spec.params,
      pollMs: entry.pollMs,
      pollMsLazy: entry.pollMsLazy,
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
    if (this.running) this.startEntry(entry);
    this.emitSubscriptionsChange();
    return {
      waitForFirstSync: () => entry.firstSync,
      unsubscribe: () => this.unsubscribe(entry),
    };
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

  private startEntry(entry: Entry): void {
    if (entry.stopped || (!entry.boot && entry.refs === 0)) return;
    entry.generation += 1;
    const generation = entry.generation;
    void this.pollLoop(entry, generation);
  }

  private async pollLoop(entry: Entry, generation: number): Promise<void> {
    while (this.running && entry.generation === generation && !entry.stopped) {
      let waitMs = this.connectedMode ? entry.pollMsLazy : entry.pollMs;
      try {
        const basis = await loadBasis(this.options.db, entry.scope);
        const response = await this.options.postQuery(
          requestFromBasis(entry, basis)
        );
        const action = await applyResponse(this.options, entry, response);
        if (action === 'stop') entry.stopped = true;
        if (action === 'resync') continue;
      } catch (error) {
        this.options.onError(error);
        waitMs = ERROR_POLL_MS;
      }
      if (!entry.stopped) await delay(waitMs);
    }
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
