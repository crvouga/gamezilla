import type { GetFreshTokenOptions } from '@pkgs/auth/client/auth-client-port';
import { useSecureStorageItem } from '@pkgs/secure-storage/use-secure-storage-item';
import { useCallback } from 'react';

import { SESSION_TOKEN_KEY } from './auth-storage-keys';
import { useAuthClientPort } from './auth-client-provider';

/**
 * Reactive bearer token for the current session. Reads secure storage populated
 * by {@link AuthBridge} from {@link AuthClientPort.getFreshToken}; `null` when
 * signed out or before hydration completes.
 */
export function useFreshAuthToken(): string | null {
  const port = useAuthClientPort();
  const { session, isHydrated } = port.useAuthSession();
  const { value } = useSecureStorageItem(SESSION_TOKEN_KEY);
  if (!isHydrated || session === null) return null;
  if (typeof value === 'string' && value.length > 0) return value;
  return null;
}

export type GetFreshAuthTokenFn = (
  options?: GetFreshTokenOptions
) => Promise<string | null>;

/** Returns the port's async token fetcher for one-off authenticated requests. */
export function useGetFreshAuthToken(): GetFreshAuthTokenFn {
  const port = useAuthClientPort();
  return useCallback(
    (options?: GetFreshTokenOptions) => port.getFreshToken(options),
    [port]
  );
}
