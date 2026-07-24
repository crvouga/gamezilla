import { useSecureStorage } from '@pkgs/secure-storage/interface';
import { writeSecureStorageItem } from '@pkgs/secure-storage/use-secure-storage-item';
import { useCallback } from 'react';

import { isUuid } from '../shared/device-id';
import { useAuthClientPort } from './auth-client-provider';
import { LAST_LOCAL_ACCOUNT_ID_KEY } from './auth-storage-keys';

export type SwitchAccountArgs = {
  readonly sessionId: string;
  /** Roster account id when known — written before setActive. */
  readonly accountId?: string | null;
};

/** Activates another local auth session (multi-account switch). */
export function useSwitchAccount(): (
  args: SwitchAccountArgs
) => Promise<void> {
  const port = useAuthClientPort();
  const storage = useSecureStorage();

  return useCallback(
    async (args: SwitchAccountArgs) => {
      const accountId = args.accountId ?? null;
      // Point SyncEngineBoot / profile watches at the target before Clerk flips
      // isActive, so menu + avatar don't paint the previous identity mid-switch.
      if (accountId !== null && isUuid(accountId)) {
        await writeSecureStorageItem(
          storage,
          LAST_LOCAL_ACCOUNT_ID_KEY,
          accountId
        );
      }
      await port.switchAccount(args.sessionId);
    },
    [port, storage]
  );
}
