import { assert } from '@gamezilla/lib/assert';
import { fireAndForget } from '@gamezilla/lib/async/fire-and-forget';
import type { PubSub, Unsubscribe } from '@gamezilla/lib/pub-sub/interface';
import type { PatchDb, PatchDbQuery, PatchDbResult } from '../interface';
import { OPEN_PATCHES_DB_CONTEXT } from '../interface';

/** Pub/sub topic carrying patch-db invalidation events. */
export const PATCHES_DB_TOPIC = 'patch-db';

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
  pubSubUnsub: Unsubscribe | null;
};

export type ActiveQueryRegistryOptions = {
  read: (query: PatchDbQuery) => Promise<PatchDbResult>;
  pubSub: PubSub;
  isDestroyed: () => boolean;
  /** Called when the registry transitions from empty -> non-empty. */
  onFirstSubscriber: () => void;
  /** Called when the registry transitions from non-empty -> empty. */
  onLastUnsubscribe: () => void;
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

  constructor(options: ActiveQueryRegistryOptions) {
    this.read = options.read;
    this.pubSub = options.pubSub;
    this.isDestroyed = options.isDestroyed;
    this.onFirstSubscriber = options.onFirstSubscriber;
    this.onLastUnsubscribe = options.onLastUnsubscribe;
  }

  /** Test/diagnostics: snapshot of all live entries. */
  values(): ActiveQuery[] {
    return Array.from(this.entries.values());
  }

  size(): number {
    return this.entries.size;
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
      pubSubUnsub: null,
    };
    this.entries.set(key, entry);
    entry.pubSubUnsub = this.pubSub.subscribe(PATCHES_DB_TOPIC, () => {
      fireAndForget(this.notify(key), {
        component: 'ActiveQueryRegistry',
        op: 'notify-invalidation',
        queryKey: key,
      });
    });
    fireAndForget(this.notify(key), {
      component: 'ActiveQueryRegistry',
      op: 'notify',
      queryKey: key,
    });
    return entry;
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
      const result = await this.read(entry.query);
      if (this.isDestroyed()) return;
      entry.lastResult = result;
      for (const l of [...entry.listeners]) l(result);
    })();
    entry.inFlight = run.finally(() => {
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
    });
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
