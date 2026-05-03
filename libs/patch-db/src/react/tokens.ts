import type { InjectionToken } from '@gamezilla/lib/dependency-injection/dependency-injection-container';
import type { PubSub } from '@gamezilla/lib/pub-sub/interface';
import type { PatchDb } from '../interface';

export const PatchDbToken: InjectionToken<PatchDb> = Symbol('PatchDb');

/** In-memory bus used by {@link SyncPatchDb} (e.g. subscribe to sync-error topic). */
export const PatchDbSyncPubSubToken: InjectionToken<PubSub> =
  Symbol('PatchDbSyncPubSub');
