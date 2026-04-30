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

export class SubscribablePatchesDb implements PatchesDb {
  get hooks() {
    return this.db.hooks;
  }

  get compaction() {
    return this.db.compaction;
  }

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
      listener: (result: PatchesDbResult) => void
    ): Unsubscribe => {
      const notify = async () => {
        const [result] = await this.db.read([query], OPEN_PATCHES_DB_CONTEXT);
        assert.ok(
          result !== null && result !== undefined,
          'read([query]) must return one result'
        );
        listener(result);
      };
      void notify();
      return this.pubSub.subscribe(PATCHES_DB_TOPIC, notify);
    },
    entities: (
      query: PatchesDbQuery,
      listener: (result: PatchesDbResult) => void
    ): Unsubscribe => {
      const notify = async () => {
        const [result] = await this.db.read([query], OPEN_PATCHES_DB_CONTEXT);
        assert.ok(
          result !== null && result !== undefined,
          'read([query]) must return one result'
        );
        listener(result);
      };
      void notify();
      return this.pubSub.subscribe(PATCHES_DB_TOPIC, notify);
    },
  };
}
