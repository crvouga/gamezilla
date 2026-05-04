import { readLastLocalAccountId } from '@gamezilla/client/db/account-local-state';
import { atomEffect } from 'jotai-effect';
import { accountIdAtom, secureStorageAtom } from './atoms';

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
