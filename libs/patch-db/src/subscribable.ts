import { assert } from '@gamezilla/lib/assert';
import { InjectionToken } from '@gamezilla/lib/dependency-injection/dependency-injection-container';
import { PubSub, Unsubscribe } from '@gamezilla/lib/pub-sub/interface';
import {
  Patch,
  PatchesDb,
  PatchesDbContext,
  PatchesDbQuery,
  PatchesDbResult,
  PatchInput,
  OPEN_PATCHES_DB_CONTEXT,
} from './interface';

const PATCHES_DB_TOPIC = 'patches-db';

/** Any PatchesDb that exposes subscribe.entities and subscribe.patches (e.g. SubscribablePatchesDb, SyncPatchesDb) */
export type SubscribablePatchesDbLike = PatchesDb & {
  subscribe: {
    patches: (
      query: PatchesDbQuery,
      listener: (result: PatchesDbResult) => void
    ) => Unsubscribe;
    entities: (
      query: PatchesDbQuery,
      listener: (result: PatchesDbResult) => void
    ) => Unsubscribe;
  };
};

export const SubscribablePatchesDbToken: InjectionToken<SubscribablePatchesDbLike> =
  Symbol('SubscribablePatchesDb');

type SubscriberListener = (result: PatchesDbResult) => void;

type SubscriptionGroup = {
  query: PatchesDbQuery;
  listeners: Set<SubscriberListener>;
  /** Last delivered result, served immediately to late-joining subscribers. */
  lastResult: PatchesDbResult | null;
  /** Active read coalesced across listeners; collapses bursts of invalidations. */
  inFlight: Promise<void> | null;
  /** True when an invalidation arrived while a read was in flight. */
  rerunPending: boolean;
  pubSubUnsub: Unsubscribe | null;
};

export class SubscribablePatchesDb implements PatchesDb {
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
    private db: PatchesDb,
    private pubSub: PubSub
  ) {}

  async write(
    patches: PatchInput[],
    ctx: PatchesDbContext = OPEN_PATCHES_DB_CONTEXT
  ): Promise<Patch[]> {
    const result = await this.db.write(patches, ctx);
    this.pubSub.publish(PATCHES_DB_TOPIC, { type: 'invalidated' });
    return result;
  }

  read(
    queries: PatchesDbQuery[],
    ctx: PatchesDbContext = OPEN_PATCHES_DB_CONTEXT
  ): Promise<PatchesDbResult[]> {
    return this.db.read(queries, ctx);
  }

  async update(
    updates: { patchId: string; attributes: Record<string, unknown> }[],
    ctx: PatchesDbContext = OPEN_PATCHES_DB_CONTEXT
  ): Promise<void> {
    return this.db.update(updates, ctx);
  }

  subscribe = {
    patches: (
      query: PatchesDbQuery,
      listener: SubscriberListener
    ): Unsubscribe => this.subscribeGroup(this.patchGroups, query, listener),
    entities: (
      query: PatchesDbQuery,
      listener: SubscriberListener
    ): Unsubscribe => this.subscribeGroup(this.entityGroups, query, listener),
  };

  private subscribeGroup(
    groups: Map<string, SubscriptionGroup>,
    query: PatchesDbQuery,
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
    query: PatchesDbQuery
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
