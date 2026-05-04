import { removeLegacyPeerSeedIfPresent } from '@gamezilla/client/auth/peer-identity';
import { readLastLocalAccountId } from '@gamezilla/client/db/account-local-state';
import { atomEffect } from 'jotai-effect';
import { accountIdAtom, secureStorageAtom } from './atoms';

/** One-shot: drop obsolete `peer.seed.v1` after spaces → per-tab / per-space keys. */
export const legacyPeerSeedCleanupEffect = atomEffect((get) => {
  const storage = get(secureStorageAtom);
  void removeLegacyPeerSeedIfPresent(storage);
});

export const hydrateAccountIdEffect = atomEffect((get, set) => {
  let cancelled = false;
  const storage = get(secureStorageAtom);
  void readLastLocalAccountId(storage).then((id) => {
    if (cancelled) return;
    if (id !== null) set(accountIdAtom, id);
  });
  return () => {
    cancelled = true;
  };
});
