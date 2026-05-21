import { useConfigService } from '@libs/auth/client/config-service-context';
import { useDeviceId } from '@libs/auth/client/use-device-id';
import { useCachedPromise } from '@pkgs/async/use-cached-promise';
import { useSqlClient } from '@pkgs/sql-client/react-context';
import { PatchDbContextProvider } from '@pkgs/patch-db/react';
import { use, type ReactNode } from 'react';

import { useApiClient } from '../api/api-context';
import { createPatchDb } from '../patch-db/create-patch-db';
import { MAIN_SQLITE_DB_NAME } from '../storage/open-main-sql-client';

/**
 * Builds the patch-db once per app instance on top of the static SQL client
 * exposed by {@link SqlClientProvider} and publishes it as the only patch-db
 * value. Auth identity is read lazily from the secure-storage cache, so
 * sign-in / sign-out / token rotation never trigger a rebuild.
 *
 * Calls `useDeviceId()` so the secure-storage cache is hydrated (and a fresh
 * UUID seeded on first run) **before** {@link createPatchDb} reads it.
 */
export function PatchDbProvider({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  const sql = useSqlClient();
  const apiClient = useApiClient();
  const config = useConfigService();
  // Ensures the device id is hydrated/seeded into the secure-storage cache
  // before patch-db boot reads it via `getCachedDeviceId`.
  useDeviceId();

  const patchDbPromise = useCachedPromise(
    // eslint-disable-next-line lingui/no-unlocalized-strings -- Internal cache key, not user-facing.
    `patch-db:${MAIN_SQLITE_DB_NAME}`,
    () =>
      createPatchDb({
        sql,
        config,
        apiClient,
      })
  );
  const value = use(patchDbPromise);

  return (
    <PatchDbContextProvider value={value}>{children}</PatchDbContextProvider>
  );
}
