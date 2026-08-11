import type { AuthClientStorage } from '@pkgs/auth-better-auth/client';
import type { SecureStorageStore } from '@pkgs/secure-storage/secure-storage-store';
import { createContext, type ReactNode, useContext } from 'react';

import type { OpenLocalSqlClient } from '../sync/create-local-sync-engine';
import type { AppSyncEnginePool } from '../sync/sync-engine-pool';

/**
 * Composition seams for product simulations. Every field is optional; when
 * omitted the provider builds its production default, so shipping boot is
 * unchanged. Sims wire an in-process API origin, per-actor secure storage, a
 * memory SQLite opener, and an isolated sync-engine pool.
 */
export type AppOverrides = {
  /** API base URL for {@link AppConfigService} (default `EXPO_PUBLIC_API_URL`). */
  readonly apiUrl?: string;
  /** Better Auth base URL (default `EXPO_PUBLIC_API_URL`). */
  readonly authBaseURL?: string;
  /**
   * Sync cookie/bearer storage for Better Auth expoClient (default
   * `expo-secure-store`). Sims inject {@link createInMemoryAuthClientStorage}.
   */
  readonly authClientStorage?: AuthClientStorage;
  /** Per-actor secure-storage store (default app-lifetime store). */
  readonly secureStorageStore?: SecureStorageStore;
  /** Local SQLite opener (default OPFS / expo-sqlite). */
  readonly openSqlClient?: OpenLocalSqlClient;
  /** Isolated sync-engine pool (default process-wide global pool). */
  readonly syncEnginePool?: AppSyncEnginePool;
};

const EMPTY_OVERRIDES: AppOverrides = {};

const AppOverridesContext = createContext<AppOverrides>(EMPTY_OVERRIDES);

export function useAppOverrides(): AppOverrides {
  return useContext(AppOverridesContext);
}

export function AppOverridesProvider({
  value,
  children,
}: {
  value: AppOverrides;
  children: ReactNode;
}): ReactNode {
  return (
    <AppOverridesContext.Provider value={value}>
      {children}
    </AppOverridesContext.Provider>
  );
}
