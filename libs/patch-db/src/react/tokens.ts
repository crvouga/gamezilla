import type { InjectionToken } from '@gamezilla/lib/dependency-injection/dependency-injection-container';
import type { PubSub } from '@gamezilla/lib/pub-sub/interface';
import type { PatchDb } from '../interface';
import type { SyncPatchDb } from '../impl-sync/impl-sync';

export const PatchDbToken: InjectionToken<PatchDb> = Symbol('PatchDb');

/** Raw sync engine (unwrap decorators) for lifecycle e.g. {@link SyncPatchDb.destroy}. */
export const SyncPatchDbToken: InjectionToken<SyncPatchDb> =
  Symbol('SyncPatchDb');

/** In-memory bus used by {@link SyncPatchDb} (e.g. subscribe to sync-error topic). */
export const PatchDbSyncPubSubToken: InjectionToken<PubSub> =
  Symbol('PatchDbSyncPubSub');
