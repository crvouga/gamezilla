import { assert } from '@gamezilla/lib/assert';
import type { PubSub, Unsubscribe } from '@gamezilla/lib/pub-sub/interface';
import {
  PATCHES_DB_INVALIDATED_TYPE,
  PATCHES_DB_TOPIC,
} from './impl-sync/active-query-registry';
import type {
  PatchDb,
  PatchDbQuery,
  PatchDbResult,
  PatchInput,
  WritePatchesResult,
} from './interface';
import { OPEN_PATCHES_DB_CONTEXT } from './interface';

/** Any PatchDb that exposes subscribe.entities and subscribe.patches (e.g. SubscribablePatchDb, SyncPatchDb) */
export type SubscribablePatchDbLike = PatchDb & {
  subscribe: {
    patches: (
      query: PatchDbQuery,
      listener: (result: PatchDbResult) => void
    ) => Unsubscribe;
    entities: (
      query: PatchDbQuery,
      listener: (result: PatchDbResult) => void
    ) => Unsubscribe;
  };
};

type SubscriberListener = (result: PatchDbResult) => void;

type SubscriptionGroup = {
  query: PatchDbQuery;
  listeners: Set<SubscriberListener>;
  /** Last delivered result, served immediately to late-joining subscribers. */
  lastResult: PatchDbResult | null;
  /** Active read coalesced across listeners; collapses bursts of invalidations. */
  inFlight: Promise<void> | null;
  /** True when an invalidation arrived while a read was in flight. */
  rerunPending: boolean;
  pubSubUnsub: Unsubscribe | null;
};

export class SubscribablePatchDb implements PatchDb {
  get hooks() {
    return this.db.hooks;
  }

  get compaction() {
    return this.db.compaction;
  }

  /**
   * Per-queryKey subscription groups. All listeners on the same queryKey
   * share one underlying read per invalidation, eliminating N x reads on
   * writes when many components/hooks subscribe to identical queries.
   */
  private entityGroups = new Map<string, SubscriptionGroup>();
  private patchGroups = new Map<string, SubscriptionGroup>();

  constructor(
    private db: PatchDb,
    private pubSub: PubSub
  ) {}

  async write(
    patches: PatchInput[],
    ctx: Readonly<Record<string, unknown>> = OPEN_PATCHES_DB_CONTEXT
  ): Promise<WritePatchesResult> {
    const result = await this.db.write(patches, ctx);
    this.pubSub.publish(PATCHES_DB_TOPIC, {
      type: PATCHES_DB_INVALIDATED_TYPE,
    });
    return result;
  }

  read(
    queries: PatchDbQuery[],
    ctx: Readonly<Record<string, unknown>> = OPEN_PATCHES_DB_CONTEXT
  ): Promise<PatchDbResult[]> {
    return this.db.read(queries, ctx);
  }

  async update(
    updates: { patchId: string; attributes: Record<string, unknown> }[],
    ctx: Readonly<Record<string, unknown>> = OPEN_PATCHES_DB_CONTEXT
  ): Promise<void> {
    return this.db.update(updates, ctx);
  }

  subscribe = {
    patches: (query: PatchDbQuery, listener: SubscriberListener): Unsubscribe =>
      this.subscribeGroup(this.patchGroups, query, listener),
    entities: (
      query: PatchDbQuery,
      listener: SubscriberListener
    ): Unsubscribe => this.subscribeGroup(this.entityGroups, query, listener),
  };

  private subscribeGroup(
    groups: Map<string, SubscriptionGroup>,
    query: PatchDbQuery,
    listener: SubscriberListener
  ): Unsubscribe {
    const queryKey = JSON.stringify(query);
    let group = groups.get(queryKey);
    if (group === undefined) {
      group = this.openGroup(groups, queryKey, query);
    }
    group.listeners.add(listener);

    if (group.lastResult !== null) {
      listener(group.lastResult);
    }

    return () => {
      assert.defined(group, 'group must exist when unsubscribing', {
        queryKey,
      });
      group.listeners.delete(listener);
      if (group.listeners.size === 0) {
        group.pubSubUnsub?.();
        group.pubSubUnsub = null;
        groups.delete(queryKey);
      }
    };
  }

  private openGroup(
    groups: Map<string, SubscriptionGroup>,
    queryKey: string,
    query: PatchDbQuery
  ): SubscriptionGroup {
    const group: SubscriptionGroup = {
      query,
      listeners: new Set(),
      lastResult: null,
      inFlight: null,
      rerunPending: false,
      pubSubUnsub: null,
    };
    groups.set(queryKey, group);

    const notify = (): Promise<void> => {
      if (group.inFlight !== null) {
        group.rerunPending = true;
        return group.inFlight;
      }
      const run = (async () => {
        const [result] = await this.db.read(
          [group.query],
          OPEN_PATCHES_DB_CONTEXT
        );
        assert.ok(
          result !== null && result !== undefined,
          'read([query]) must return one result'
        );
        group.lastResult = result;
        for (const l of [...group.listeners]) l(result);
      })();
      group.inFlight = run.finally(() => {
        group.inFlight = null;
        if (group.rerunPending && group.listeners.size > 0) {
          group.rerunPending = false;
          void notify();
        } else {
          group.rerunPending = false;
        }
      });
      return group.inFlight;
    };

    void notify();
    group.pubSubUnsub = this.pubSub.subscribe(PATCHES_DB_TOPIC, () => {
      void notify();
    });
    return group;
  }
}
