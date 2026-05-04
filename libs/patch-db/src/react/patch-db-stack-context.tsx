import { createContext, useContext } from 'react';
import type { PubSub } from '@gamezilla/lib/pub-sub/interface';
import type { PatchDb } from '../interface';
import type { SyncPatchDb } from '../impl-sync/impl-sync';
import type { SubscribablePatchDbLike } from '../subscribable';

export type PatchDbStackValue = {
  readonly db: PatchDb;
  readonly sync: SyncPatchDb;
  readonly pubSub: PubSub;
  /** Decorated db (e.g. {@link PatchMetadataStamper}) implementing `subscribe`. */
  readonly decorated: SubscribablePatchDbLike;
};

const PatchDbStackContext = createContext<PatchDbStackValue | null>(null);

export function usePatchDbStack(): PatchDbStackValue {
  const v = useContext(PatchDbStackContext);
  if (v === null) {
    throw new Error('usePatchDbStack: PatchDbStackContext.Provider missing');
  }
  return v;
}

export const PatchDbStackContextProvider = PatchDbStackContext.Provider;
