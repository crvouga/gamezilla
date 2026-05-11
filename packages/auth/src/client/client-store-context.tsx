import type { KeyValueStorage } from '@gamezilla/lib/key-value-storage/interface';
import type { Logger } from '@gamezilla/lib/logger/logger';
import type { SecureStorage } from '@gamezilla/lib/secure-storage/interface';
import type { PatchDbStackValue } from '@gamezilla/patch-db/react';
import { createContext, useContext } from 'react';

import type { ConfigService } from './config-service-types';
import type { DeviceService } from './device-service';
import type { SessionService } from './session-service';

/**
 * Inverted dependency: bounded contexts depend on this **port**; the Expo app
 * (`@gamezilla/client`) supplies the live implementation via `ClientStoreProvider`.
 */
export type ClientStore = {
  subscribe(listener: () => void): () => void;

  getAccountId(): string | null;
  setAccountId(id: string | null): void;

  getSessionToken(): string | null;
  setSessionToken(token: string | null): void;

  getConfigService(): ConfigService;
  getLogger(): Logger;
  getSecureStorage(): SecureStorage;
  getKeyValueStorage(): KeyValueStorage;

  getDeviceService(): Promise<DeviceService>;
  getSessionService(): Promise<SessionService>;
  getPatchDbStack(): Promise<PatchDbStackValue>;

  enqueueSqlClientLifecycle<T>(fn: () => Promise<T>): Promise<T>;
  awaitSqlClientDisconnectChain(): Promise<void>;
};

const ClientStoreContext = createContext<ClientStore | null>(null);

export function useClientStore(): ClientStore {
  const v = useContext(ClientStoreContext);
  if (v === null) {
    throw new Error(
      'useClientStore: missing ClientStoreProvider — wrap the app root with the provider from @gamezilla/client'
    );
  }
  return v;
}

export const ClientStoreContextProvider = ClientStoreContext.Provider;
