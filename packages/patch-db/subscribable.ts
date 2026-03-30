import { assert } from '@gamezilla/shared/assert';
import { InjectionToken } from '@gamezilla/shared/dependency-injection/dependency-injection-container';
import { PubSub, Unsubscribe } from '@gamezilla/shared/pub-sub/interface';
import {
  Patch,
  PatchesDb,
  PatchesDbQuery,
  PatchesDbResult,
  PatchInput,
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
  constructor(
    private db: PatchesDb,
    private pubSub: PubSub
  ) {}

  async write(patches: PatchInput[]): Promise<Patch[]> {
    const result = await this.db.write(patches);
    this.pubSub.publish(PATCHES_DB_TOPIC, { type: 'invalidated' });
    return result;
  }

  read(queries: PatchesDbQuery[]): Promise<PatchesDbResult[]> {
    return this.db.read(queries);
  }

  async update(
    updates: { patchId: string; attributes: Record<string, unknown> }[]
  ): Promise<void> {
    return this.db.update(updates);
  }

  subscribe = {
    patches: (
      query: PatchesDbQuery,
      listener: (result: PatchesDbResult) => void
    ): Unsubscribe => {
      const notify = async () => {
        const [result] = await this.db.read([query]);
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
        const [result] = await this.db.read([query]);
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
