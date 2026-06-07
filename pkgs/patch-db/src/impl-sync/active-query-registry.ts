import { assert } from '@pkgs/assert';
import { fireAndForget } from '@pkgs/async/fire-and-forget';
import { asKeyword, type Keyword } from '@pkgs/keyword';
import type { PubSub, Unsubscribe } from '@pkgs/pub-sub/interface';
import type { PatchDb, PatchDbQuery, PatchDbResult } from '../interface';
import { OPEN_PATCHES_DB_CONTEXT } from '../interface';

/** Pub/sub topic carrying patch-db invalidation events. */
export const PATCHES_DB_TOPIC: Keyword = asKeyword('patch-db.bus/invalidated');

/** Discriminator value for invalidation messages on {@link PATCHES_DB_TOPIC}. */
export const PATCHES_DB_INVALIDATED_TYPE: Keyword = asKeyword(
  'patch-db.bus/invalidated'
);

/**
 * When `touched` is present, {@link ActiveQueryRegistry} may skip re-reads for
 * simple single-entity queries whose key is not in the touched set.
 */
export type PatchDbInvalidationMessage = {
  type: typeof PATCHES_DB_INVALIDATED_TYPE;
  touched?: readonly { entityType: string; entityId: string }[];
};

/** Returns true when a targeted invalidation can skip re-reading `query`. */
export function shouldSkipTargetedEntityReread(
  query: PatchDbQuery,
  message: unknown
): boolean {
  if (typeof message !== 'object' || message === null) return false;
  const touched = (message as PatchDbInvalidationMessage).touched;
  if (!Array.isArray(touched) || touched.length === 0) return false;
  if (query.where !== undefined && query.where !== null) return false;
  if (typeof query.entityId !== 'string') return false;
  if (query.entityType === undefined || query.entityType === '') return false;
  const hit = touched.some((row) => {
    if (typeof row !== 'object' || row === null) return false;
    const o = row as Record<string, unknown>;
    return (
      o['entityType'] === query.entityType && o['entityId'] === query.entityId
    );
  });
  return !hit;
}

export type ActiveQueryListener = (result: PatchDbResult) => void;

export type ActiveQuery = {
  query: PatchDbQuery;
  listeners: Set<ActiveQueryListener>;
  /** Last delivered result; served instantly to late subscribers (no read flicker on remount). */
  lastResult: PatchDbResult | null;
  /** Active read collapsed across listeners; coalesces bursts of invalidations. */
  inFlight: Promise<void> | null;
  /** True when an invalidation arrived mid-read, scheduling exactly one re-read on settle. */
  rerunPending: boolean;
  /**
   * One-shot flag for this entry lifecycle. True after we have observed a hydrated empty
   * local read and fired {@link ActiveQueryRegistryOptions.onHydratedEmptyOnce}.
   */
  hydratedEmptyFired: boolean;
  pubSubUnsub: Unsubscribe | null;
};

export type ActiveQueryRegistryOptions = {
  read: (query: PatchDbQuery) => Promise<PatchDbResult>;
  pubSub: PubSub;
  isDestroyed: () => boolean;
  /**
   * When true, invalidation messages that carry `touched` skip re-reads for
   * simple `(entityType, entityId)` queries not listed in `touched`.
   */
  targetedInvalidation?: boolean;
  /** Called when the registry transitions from empty -> non-empty. */
  onFirstSubscriber: () => void;
  /** Called when the registry transitions from non-empty -> empty. */
  onLastUnsubscribe: () => void;
  /**
   * Called exactly once per query-key lifecycle when the first hydrated local
   * result is empty (no entities and no patches). Intended to trigger a best-effort
   * immediate poll so newly subscribed queries don't wait for the next poll interval.
   */
  onHydratedEmptyOnce?: (args: {
    queryKey: string;
    query: PatchDbQuery;
    result: PatchDbResult;
  }) => void;
};

/**
 * Per-queryKey subscription registry shared by every listener for the same
 * shape. One underlying read runs per invalidation regardless of subscriber
 * count; late joiners get the last result synchronously so a second hook for
 * an already-loaded query never sees a `loading` flash.
 */
export class ActiveQueryRegistry {
  private readonly entries = new Map<string, ActiveQuery>();
  private readonly read: ActiveQueryRegistryOptions['read'];
  private readonly pubSub: PubSub;
  private readonly isDestroyed: () => boolean;
  private readonly onFirstSubscriber: () => void;
  private readonly onLastUnsubscribe: () => void;
  private readonly onHydratedEmptyOnce: ActiveQueryRegistryOptions['onHydratedEmptyOnce'];
  private readonly targetedInvalidation: boolean;

  constructor(options: ActiveQueryRegistryOptions) {
    this.read = options.read;
    this.pubSub = options.pubSub;
    this.isDestroyed = options.isDestroyed;
    this.targetedInvalidation = options.targetedInvalidation === true;
    this.onFirstSubscriber = options.onFirstSubscriber;
    this.onLastUnsubscribe = options.onLastUnsubscribe;
    this.onHydratedEmptyOnce = options.onHydratedEmptyOnce;
  }

  /** Test/diagnostics: snapshot of all live entries. */
  values(): ActiveQuery[] {
    return Array.from(this.entries.values());
  }

  size(): number {
    return this.entries.size;
  }

  /**
   * Drains all in-flight reads across every active query key.
   *
   * Used by cache warmers that want `write()` to resolve only after all
   * subscriptions have re-read the local DB following an invalidation.
   */
  async flushInFlight(): Promise<void> {
    if (this.isDestroyed()) return;
    // `rerunPending` can schedule a follow-up read after an in-flight read
    // settles, so we loop until all entries are quiet.
    let shouldContinue = true;
    while (shouldContinue) {
      const pending: Promise<void>[] = [];
      for (const entry of this.entries.values()) {
        if (entry.inFlight !== null) pending.push(entry.inFlight);
      }
      if (pending.length === 0) return;
      await Promise.allSettled(pending);
      if (this.isDestroyed()) return;
      const stillPending = Array.from(this.entries.values()).some(
        (e) => e.inFlight !== null || e.rerunPending
      );
      if (!stillPending) return;
      shouldContinue = stillPending;
    }
  }

  subscribe(query: PatchDbQuery, listener: ActiveQueryListener): Unsubscribe {
    const key = JSON.stringify(query);
    let entry = this.entries.get(key);
    const isFirstEntry = entry === undefined;
    if (entry === undefined) {
      entry = this.open(key, query);
      this.onFirstSubscriber();
    }
    entry.listeners.add(listener);

    if (entry.lastResult !== null) {
      listener(entry.lastResult);
    } else if (!isFirstEntry) {
      fireAndForget(this.notify(key), {
        component: 'ActiveQueryRegistry',
        op: 'notify-late-join',
        queryKey: key,
      });
    }

    return () => {
      assert.defined(entry, 'entry must exist when unsubscribing', {
        queryKey: key,
      });
      entry.listeners.delete(listener);
      if (entry.listeners.size === 0) {
        entry.pubSubUnsub?.();
        entry.pubSubUnsub = null;
        this.entries.delete(key);
        if (this.entries.size === 0) this.onLastUnsubscribe();
      }
    };
  }

  private open(key: string, query: PatchDbQuery): ActiveQuery {
    const entry: ActiveQuery = {
      query,
      listeners: new Set(),
      lastResult: null,
      inFlight: null,
      rerunPending: false,
      hydratedEmptyFired: false,
      pubSubUnsub: null,
    };
    this.entries.set(key, entry);
    entry.pubSubUnsub = this.pubSub.subscribe(
      PATCHES_DB_TOPIC,
      (msg: unknown) => {
        if (
          this.targetedInvalidation &&
          shouldSkipTargetedEntityReread(entry.query, msg)
        ) {
          return;
        }
        fireAndForget(this.notify(key), {
          component: 'ActiveQueryRegistry',
          op: 'notify-invalidation',
          queryKey: key,
        });
      }
    );
    fireAndForget(this.notify(key), {
      component: 'ActiveQueryRegistry',
      op: 'notify',
      queryKey: key,
    });
    return entry;
  }

  /** Delivers a completed read to listeners and fires the hydrated-empty hook once. */
  private applyReadResult(
    key: string,
    entry: ActiveQuery,
    result: PatchDbResult
  ): void {
    if (this.isDestroyed() || !this.entries.has(key)) return;
    entry.lastResult = result;
    for (const l of [...entry.listeners]) l(result);
    const isHydratedEmpty =
      result.entities.length === 0 && result.patches.length === 0;
    if (!entry.hydratedEmptyFired && isHydratedEmpty) {
      entry.hydratedEmptyFired = true;
      this.onHydratedEmptyOnce?.({ queryKey: key, query: entry.query, result });
    }
  }

  /**
   * Runs at most one read in flight per key. Invalidations that fire while a
   * read is pending collapse into a single follow-up read that runs after the
   * current one resolves.
   */
  private async notify(key: string): Promise<void> {
    if (this.isDestroyed()) return;
    const entry = this.entries.get(key);
    if (entry === undefined) return;
    if (entry.inFlight !== null) {
      entry.rerunPending = true;
      await entry.inFlight;
      return;
    }
    const run = (async () => {
      try {
        const result = await this.read(entry.query);
        this.applyReadResult(key, entry, result);
      } catch (err) {
        if (this.isDestroyed() || !this.entries.has(key)) return;
        throw err;
      }
    })();
    const settle = () => {
      entry.inFlight = null;
      const shouldRerun =
        entry.rerunPending && entry.listeners.size > 0 && !this.isDestroyed();
      entry.rerunPending = false;
      if (shouldRerun) {
        fireAndForget(this.notify(key), {
          component: 'ActiveQueryRegistry',
          op: 'notify-rerun',
          queryKey: key,
        });
      }
    };
    // Avoid relying on Promise.prototype.finally for environments where it may be missing.
    entry.inFlight = Promise.resolve(run).then(
      () => settle(),
      (err) => {
        settle();
        if (!this.isDestroyed() && this.entries.has(key)) throw err;
      }
    );
    await entry.inFlight;
  }
}

/** Helper that wraps `db.read([q])` and asserts a single result. */
export function singleResultReader(
  db: PatchDb
): (query: PatchDbQuery) => Promise<PatchDbResult> {
  return async (query) => {
    const [result] = await db.read([query], OPEN_PATCHES_DB_CONTEXT);
    assert.ok(
      result !== null && result !== undefined,
      'read([query]) must return one result'
    );
    return result;
  };
}
