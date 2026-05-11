import { useAccountIdModel } from '@gamezilla/auth/client/account-id-context';
import { PatchDbLocalDataActionsContext } from '@gamezilla/auth/client/patch-db-local-data-actions-context';
import { useSessionTokenModel } from '@gamezilla/auth/client/session-token-context';
import { useSecureStorage } from '@gamezilla/lib/secure-storage/interface';
import { useMemo, type ReactNode } from 'react';

import {
  clearLocalDatabaseAndReloadWithDeps,
  type PatchDbLocalDataDeps,
} from '../patch-db/patch-db-local-data-impl';

export function PatchDbLocalDataActionsProvider({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  const secure = useSecureStorage();
  const sessionToken = useSessionTokenModel();
  const accountId = useAccountIdModel();

  const deps: PatchDbLocalDataDeps = useMemo(
    () => ({ secure, sessionToken, accountId }),
    [secure, sessionToken, accountId]
  );

  const actions = useMemo(
    () => ({
      clearLocalDatabaseAndReload: () =>
        clearLocalDatabaseAndReloadWithDeps(deps),
    }),
    [deps]
  );

  return (
    <PatchDbLocalDataActionsContext.Provider value={actions}>
      {children}
    </PatchDbLocalDataActionsContext.Provider>
  );
}
