import { atomEffect } from 'jotai-effect';
import { accountIdAtom, secureStorageAtom } from './atoms';
import { getRuntimeFactories } from './runtime-factories';

export const hydrateAccountIdEffect = atomEffect((get, set) => {
  let cancelled = false;
  const storage = get(secureStorageAtom);
  void getRuntimeFactories()
    .readLastLocalAccountId(storage)
    .then((id) => {
      if (cancelled) return;
      if (id !== null) set(accountIdAtom, id);
    });
  return () => {
    cancelled = true;
  };
});
