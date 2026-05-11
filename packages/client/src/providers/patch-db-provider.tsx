import { useAccountIdModel } from '@gamezilla/auth/client/account-id-context';
import { useConfigService } from '@gamezilla/auth/client/config-service-context';
import { useDeviceService } from '@gamezilla/auth/client/device-service-context';
import { useSessionTokenModel } from '@gamezilla/auth/client/session-token-context';
import { useCachedPromise } from '@gamezilla/lib/async/use-cached-promise';
import { useSecureStorage } from '@gamezilla/lib/secure-storage/interface';
import { useSqlClient } from '@gamezilla/lib/sql-client/react-context';
import { PatchDbContextProvider } from '@gamezilla/patch-db/react';
import { use, type ReactNode } from 'react';

import { useApiClient } from '../api/api-context';
import { createPatchDb } from '../patch-db/create-patch-db';
import { MAIN_SQLITE_DB_NAME } from '../storage/open-main-sql-client';

/**
 * Builds the patch-db once per app instance on top of the static SQL client
 * exposed by {@link SqlClientProvider} and publishes it as the only patch-db
 * value. Account / session token changes still propagate through the
 * patch-db's own getters (auth/session metadata stamping) but never trigger a
 * rebuild — there is no swap.
 */
export function PatchDbProvider({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  const sql = useSqlClient();
  const apiClient = useApiClient();
  const device = useDeviceService();
  const secure = useSecureStorage();
  const config = useConfigService();
  const accountId = useAccountIdModel();
  const sessionToken = useSessionTokenModel();

  const patchDbPromise = useCachedPromise(MAIN_SQLITE_DB_NAME, () =>
    createPatchDb({
      sql,
      config,
      deviceService: device,
      storage: secure,
      apiClient,
      getAccountId: () => accountId.getAccountId(),
      getSessionToken: () => sessionToken.getSessionToken(),
      setSessionToken: (t) => sessionToken.setSessionToken(t),
    })
  );
  const value = use(patchDbPromise);

  return (
    <PatchDbContextProvider value={value}>{children}</PatchDbContextProvider>
  );
}
