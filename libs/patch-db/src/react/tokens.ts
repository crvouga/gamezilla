import type { InjectionToken } from '@gamezilla/lib/dependency-injection/dependency-injection-container';
import type { PubSub } from '@gamezilla/lib/pub-sub/interface';
import type { PatchesDb } from '../interface';

export const PatchesDbToken: InjectionToken<PatchesDb> = Symbol('PatchesDb');

/** In-memory bus used by {@link SyncPatchesDb} (e.g. subscribe to sync-error topic). */
export const PatchDbSyncPubSubToken: InjectionToken<PubSub> =
  Symbol('PatchDbSyncPubSub');
